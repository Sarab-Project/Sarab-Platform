using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SarabPlatform.Data;
using SarabPlatform.Dto;
using SarabPlatform.Enum;
using SarabPlatform.Models;
using System.IO;
using System.IO.Compression;
using System.Linq;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CollectionsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public CollectionsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult GetCollections()
        {
            var collections = _context.Collections
                .Where(c => !c.IsDeleted)
                .Include(c => c.Folders!.Where(f => !f.IsDeleted))
                .ToList();
            return Ok(collections);
        }
        
        [HttpGet("{id}")]
        public IActionResult GetCollection(int id)
        {
            var collection = _context.Collections
                .Include(c => c.Folders!.Where(f => !f.IsDeleted))
                .FirstOrDefault(c => c.Id == id && !c.IsDeleted);
            if (collection == null)
            {
                return NotFound();
            }
            return Ok(collection);
        }

        [HttpPost]
        public IActionResult CreateCollection([FromBody] CreateCollectionDto dto)
        {
            // Check if User exists
            var user = _context.Users.FirstOrDefault(u => u.Id == dto.CreatedBy);
            if (user == null)
            {
                return BadRequest("User not found.");
            }

            // Check if Owner exists
            Group? group = null;
            if (dto.OwnerType == OwnerType.Group)
            {
                group = _context.Groups.FirstOrDefault(g => g.Id == dto.OwnerId);
                if (group == null)
                {
                    return BadRequest("Group owner not found.");
                }
            }
            else
            {
                var owner = _context.Users.FirstOrDefault(u => u.Id == dto.OwnerId);
                if (owner == null)
                {
                    return BadRequest("Owner not found.");
                }
            }

            // Check if Template exists
            var template = _context.CollectionTemplates.FirstOrDefault(t => t.Id == dto.TemplateId);
            if (template == null)
            {
                return BadRequest("Template not found.");
            }

            var collection = new Collection
            {
                Name = dto.Name,
                Description = dto.Description,
                CreatedBy = dto.CreatedBy,
                GroupId = dto.OwnerType == OwnerType.Group ? dto.OwnerId : null,
                OwnerId = dto.OwnerId,
                OwnerType = dto.OwnerType,
                TemplateId = dto.TemplateId,
                CreatedAt = DateTime.UtcNow
            };
            try
            {
                _context.Collections.Add(collection);
                _context.SaveChanges();
                return CreatedAtAction(nameof(GetCollection), new { id = collection.Id }, collection);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPost("{id}/download")]
        public async Task<IActionResult> DownloadCollection(int id)
        {
            var collection = await _context.Collections.FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
            if (collection == null)
                return NotFound("Collection not found.");

            var data = await BuildCollectionZipAsync(collection, null);
            collection.DownloadCount++;
            await _context.SaveChangesAsync();
            return File(data, "application/zip", $"collection-{id}.zip");
        }

        [HttpPost("download")]
        public async Task<IActionResult> DownloadCollections([FromBody] DownloadCollectionsDto dto)
        {
            if (dto == null || dto.CollectionIds == null || !dto.CollectionIds.Any())
                return BadRequest("No collections selected.");

            var collections = await _context.Collections
                .Where(c => dto.CollectionIds.Contains(c.Id) && !c.IsDeleted)
                .ToListAsync();

            if (collections.Count != dto.CollectionIds.Count)
                return BadRequest("Some collections were not found.");

            using var memoryStream = new MemoryStream();
            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
            {
                foreach (var collection in collections)
                {
                    var collectionData = await BuildCollectionZipAsync(collection, null);
                    var entry = archive.CreateEntry($"collection-{collection.Id}.zip");
                    using var entryStream = entry.Open();
                    await entryStream.WriteAsync(collectionData);
                }
            }

            collections.ForEach(c => c.DownloadCount++);
            await _context.SaveChangesAsync();
            memoryStream.Position = 0;
            return File(memoryStream.ToArray(), "application/zip", "collections.zip");
        }

        [HttpPost("{id}/folders/download")]
        public async Task<IActionResult> DownloadCollectionFolders(int id, [FromBody] DownloadFoldersDto dto)
        {
            if (dto == null || dto.FolderIds == null || !dto.FolderIds.Any())
                return BadRequest("No folders selected.");

            var collection = await _context.Collections.FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
            if (collection == null)
                return NotFound("Collection not found.");

            var folders = await _context.Folders
                .Where(f => dto.FolderIds.Contains(f.Id) && f.CollectionId == id && !f.IsDeleted)
                .ToListAsync();

            if (folders.Count != dto.FolderIds.Count)
                return BadRequest("Some folders were not found in the collection.");

            var data = await BuildCollectionZipAsync(collection, folders.Select(f => f.Id));
            return File(data, "application/zip", $"collection-{id}-folders.zip");
        }

        private async Task<byte[]> BuildCollectionZipAsync(Collection collection, IEnumerable<int>? folderIds)
        {
            var folderQuery = _context.Folders.Where(f => f.CollectionId == collection.Id && !f.IsDeleted);
            if (folderIds != null)
                folderQuery = folderQuery.Where(f => folderIds.Contains(f.Id));

            var folders = await folderQuery.ToListAsync();
            var folderIdsList = folders.Select(f => f.Id).ToList();

            var samples = await _context.Samples
                .Where(s => !s.IsDeleted && s.FolderId.HasValue && folderIdsList.Contains(s.FolderId.Value))
                .Include(s => s.Files)
                .ToListAsync();

            using var stream = new MemoryStream();
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, true))
            {
                var metaEntry = archive.CreateEntry($"collection-{collection.Id}/metadata.txt");
                using (var entryStream = metaEntry.Open())
                using (var writer = new StreamWriter(entryStream))
                {
                    writer.WriteLine($"Collection ID: {collection.Id}");
                    writer.WriteLine($"Name: {collection.Name}");
                    writer.WriteLine($"Description: {collection.Description}");
                    writer.WriteLine($"Owner Type: {collection.OwnerType}");
                    writer.WriteLine($"Owner ID: {collection.OwnerId}");
                    writer.WriteLine($"Created By: {collection.CreatedBy}");
                    writer.WriteLine($"Created At: {collection.CreatedAt:O}");
                    writer.Flush();
                }

                foreach (var folder in folders)
                {
                    var folderName = NormalizeEntryName(folder.Name);
                    var folderPrefix = $"collection-{collection.Id}/folder-{folder.Id}-{folderName}/";
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
        public IActionResult DeleteCollection(int id)
        {
            var collection = _context.Collections.FirstOrDefault(c => c.Id == id && !c.IsDeleted);
            if (collection == null)
            {
                return NotFound();
            }
            collection.IsDeleted = true;
            collection.DeletedAt = DateTime.UtcNow;
            _context.SaveChanges();
            return NoContent();
        }

        

    }
}