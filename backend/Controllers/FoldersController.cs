using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SarabPlatform.Data;
using SarabPlatform.Dto;
using SarabPlatform.Models;
using System.IO;
using System.IO.Compression;
using System.Linq;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FoldersController : ControllerBase
    {
        private readonly AppDbContext _context;
        public FoldersController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult GetFolders()
        {
            var folders = _context.Folders
                .Where(f => !f.IsDeleted)
                .Include(f => f.Samples!.Where(sa => !sa.IsDeleted))
                .Include(f => f.Children!.Where(c => !c.IsDeleted))
                .ToList();
            return Ok(folders);
        }
        
        [HttpGet("{id}")]
        public IActionResult GetFolder(int id)
        {
            var folder = _context.Folders
                .Include(f => f.Samples!.Where(sa => !sa.IsDeleted))
                .Include(f => f.Children!.Where(c => !c.IsDeleted))
                .FirstOrDefault(f => f.Id == id && !f.IsDeleted);
            if (folder == null)
            {
                return NotFound();
            }
            return Ok(folder);
        }

        [HttpPost]
        public IActionResult CreateFolder([FromBody] CreateFolderDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Check if Collection exists
            var collection = _context.Collections.FirstOrDefault(c => c.Id == dto.CollectionId);
            if (collection == null)
            {
                return BadRequest("Collection not found.");
            }

            // Check if User exists
            var user = _context.Users.FirstOrDefault(u => u.Id == dto.CreatedBy);
            if (user == null)
            {
                return BadRequest("User not found.");
            }

            // Check if Parent exists if provided
            if (dto.ParentId.HasValue)
            {
                var parent = _context.Folders.FirstOrDefault(f => f.Id == dto.ParentId.Value && !f.IsDeleted);
                if (parent == null)
                {
                    return BadRequest("Parent folder not found.");
                }
            }

            var folder = new Folder
            {
                Name = dto.Name,
                ParentId = dto.ParentId,
                CollectionId = dto.CollectionId,
                CreatedBy = dto.CreatedBy,
                CreatedAt = DateTime.UtcNow
            };
            try
            {
                _context.Folders.Add(folder);
                _context.SaveChanges();
                return CreatedAtAction(nameof(GetFolder), new { id = folder.Id }, folder);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPost("{id}/download")]
        public async Task<IActionResult> DownloadFolder(int id)
        {
            var folder = await _context.Folders.FirstOrDefaultAsync(f => f.Id == id && !f.IsDeleted);
            if (folder == null)
                return NotFound("Folder not found.");

            var folderIds = await GetFolderTreeIdsAsync(id);
            var data = await BuildFolderZipAsync(folderIds, null);
            return File(data, "application/zip", $"folder-{id}.zip");
        }

        [HttpPost("download")]
        public async Task<IActionResult> DownloadFolders([FromBody] DownloadFoldersDto dto)
        {
            if (dto == null || dto.FolderIds == null || !dto.FolderIds.Any())
                return BadRequest("No folders selected.");

            var folders = await _context.Folders
                .Where(f => dto.FolderIds.Contains(f.Id) && !f.IsDeleted)
                .ToListAsync();

            if (folders.Count != dto.FolderIds.Count)
                return BadRequest("Some folders were not found.");

            using var memoryStream = new MemoryStream();
            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
            {
                foreach (var folder in folders)
                {
                    var folderIds = await GetFolderTreeIdsAsync(folder.Id);
                    var folderData = await BuildFolderZipAsync(folderIds, null);
                    var entry = archive.CreateEntry($"folder-{folder.Id}.zip");
                    using var entryStream = entry.Open();
                    await entryStream.WriteAsync(folderData);
                }
            }

            memoryStream.Position = 0;
            return File(memoryStream.ToArray(), "application/zip", "folders.zip");
        }

        [HttpPost("{id}/samples/download")]
        public async Task<IActionResult> DownloadFolderSamples(int id, [FromBody] DownloadSamplesDto dto)
        {
            if (dto == null || dto.SampleIds == null || !dto.SampleIds.Any())
                return BadRequest("No samples selected.");

            var folder = await _context.Folders.FirstOrDefaultAsync(f => f.Id == id && !f.IsDeleted);
            if (folder == null)
                return NotFound("Folder not found.");

            var samples = await _context.Samples
                .Where(s => dto.SampleIds.Contains(s.Id) && s.FolderId == id && !s.IsDeleted)
                .Include(s => s.Files)
                .ToListAsync();

            if (samples.Count != dto.SampleIds.Count)
                return BadRequest("Some samples were not found in this folder.");

            var data = await BuildFolderZipAsync(new List<int> { id }, dto.SampleIds);
            return File(data, "application/zip", $"folder-{id}-samples.zip");
        }

        private async Task<List<int>> GetFolderTreeIdsAsync(int rootFolderId)
        {
            var allFolders = await _context.Folders
                .Where(f => !f.IsDeleted)
                .ToListAsync();

            var result = new List<int>();
            var queue = new Queue<int>();
            queue.Enqueue(rootFolderId);

            while (queue.Any())
            {
                var currentId = queue.Dequeue();
                if (result.Contains(currentId))
                    continue;

                result.Add(currentId);
                var children = allFolders.Where(f => f.ParentId == currentId).Select(f => f.Id);
                foreach (var childId in children)
                    queue.Enqueue(childId);
            }

            return result;
        }

        private async Task<byte[]> BuildFolderZipAsync(IEnumerable<int> folderIds, IEnumerable<int>? sampleIds)
        {
            var folders = await _context.Folders
                .Where(f => folderIds.Contains(f.Id) && !f.IsDeleted)
                .ToListAsync();

            var samplesQuery = _context.Samples
                .Where(s => !s.IsDeleted && s.FolderId.HasValue && folderIds.Contains(s.FolderId.Value));

            if (sampleIds != null)
                samplesQuery = samplesQuery.Where(s => sampleIds.Contains(s.Id));

            var samples = await samplesQuery.Include(s => s.Files).ToListAsync();

            using var stream = new MemoryStream();
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, true))
            {
                foreach (var folder in folders)
                {
                    var folderName = NormalizeEntryName(folder.Name);
                    var folderPrefix = $"folder-{folder.Id}-{folderName}/";
                    var folderSamples = samples.Where(s => s.FolderId == folder.Id).ToList();

                    foreach (var sample in folderSamples)
                    {
                        var sampleTitle = NormalizeEntryName(sample.Title);
                        var samplePrefix = $"{folderPrefix}sample-{sample.Id}-{sampleTitle}/";

                        var sampleMetaEntry = archive.CreateEntry($"{samplePrefix}metadata.txt");
                        using (var sampleMetaStream = sampleMetaEntry.Open())
                        using (var sampleMetaWriter = new StreamWriter(sampleMetaStream))
                        {
                            sampleMetaWriter.WriteLine($"Sample ID: {sample.Id}");
                            sampleMetaWriter.WriteLine($"Title: {sample.Title}");
                            sampleMetaWriter.WriteLine($"Description: {sample.Description}");
                            sampleMetaWriter.WriteLine($"Created By: {sample.CreatedBy}");
                            sampleMetaWriter.WriteLine($"Created At: {sample.CreatedAt:O}");
                            sampleMetaWriter.WriteLine($"Metadata: {sample.Metadata}");
                            sampleMetaWriter.Flush();
                        }

                        foreach (var file in sample.Files?.Where(f => !f.IsDeleted) ?? Enumerable.Empty<ResourceFile>())
                        {
                            if (string.IsNullOrWhiteSpace(file.FilePath) || !System.IO.File.Exists(file.FilePath))
                                continue;

                            var entry = archive.CreateEntry($"{samplePrefix}{NormalizeEntryName(file.FileName)}");
                            using var entryStream = entry.Open();
                            using var fileStream = new FileStream(file.FilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                            await fileStream.CopyToAsync(entryStream);
                        }
                    }
                }
            }

            stream.Position = 0;
            return stream.ToArray();
        }

        private string NormalizeEntryName(string? name)
        {
            if (string.IsNullOrWhiteSpace(name))
                return string.Empty;

            var invalidChars = Path.GetInvalidFileNameChars();
            return string.Concat(name.Select(ch => invalidChars.Contains(ch) ? '_' : ch)).Replace('\\', '_').Replace('/', '_');
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFolder(int id)
        {
            var folder = _context.Folders.FirstOrDefault(f => f.Id == id && !f.IsDeleted);
            if (folder == null)
            {
                return NotFound();
            }

            folder.IsDeleted = true;
            folder.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}