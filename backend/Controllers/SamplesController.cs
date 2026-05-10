using Microsoft.AspNetCore.Mvc;
using SarabPlatform.Data;
using SarabPlatform.Dto;
using SarabPlatform.Models;
using SarabPlatform.Enum;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SarabPlatform.Services;
using SarabPlatform.DTO;
using Microsoft.VisualBasic;
using System.IO.Compression;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SamplesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly FileService _fileService;

        public SamplesController(AppDbContext context, FileService fileService)
        {
            _context = context;
            _fileService = fileService;
        }

        private IQueryable<Sample> GetActiveSamplesQuery()
        {
            return _context.Samples
                .Where(s => !s.IsDeleted)
                .Include(s => s.Files.Where(f => !f.IsDeleted));
        }

        [HttpGet]
        public async Task<IActionResult> GetSamples()
        {
            var samples = await GetActiveSamplesQuery().ToListAsync();
            return Ok(samples);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetSample(int id)
        {
            try
            {
                var sample = await GetActiveSamplesQuery()
                    .FirstOrDefaultAsync(s => s.Id == id);

                if (sample == null)
                    return NotFound();

                return Ok(sample);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        [HttpPost("upload/sarab-ai")]
        public async Task<IActionResult> UploadSampleSarabAi([FromForm] UploadSampleSarabAiDto dto)
        {
            if (dto.Videos == null || dto.Videos.Count == 0)
                return BadRequest(new { message = "At least one video is required." });

            var metadataObject = new
            {
                EyeSide = dto.EyeSide,
                Gender = dto.Gender,
                Age = dto.Age,
                city = dto.City,
                Status = dto.Status,
                profession = dto.Profession,
                notes = dto.Notes
            };
            var metadataJson = JsonSerializer.Serialize(metadataObject);

            var sample = new Sample
            {
                Title = "Sarab-Ai",
                Metadata = metadataJson,
                Files = new List<ResourceFile>()
            };

            _context.Samples.Add(sample);
            await _context.SaveChangesAsync();

            var uploadPath = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", $"sample-{sample.Id}");
            Directory.CreateDirectory(uploadPath);

            foreach (var file in dto.Videos)
            {
                var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName);
                var filePath = Path.Combine(uploadPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var resourceFile = new ResourceFile
                {
                    FileName = fileName,
                    FileType = FileType.Video,
                    FilePath = filePath,
                    Size = (int)file.Length,
                    UploadedBy = 0,
                    UploadedAt = DateTime.UtcNow,
                    SampleId = sample.Id
                };

                sample.Files.Add(resourceFile);
                _context.Files.Add(resourceFile);
            }

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetSample), new { Id = sample.Id }, sample);
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadSample([FromForm] CreateSampleDto dto)
        {
            var folder = await _context.Folders.FirstOrDefaultAsync(f => f.Id == dto.FolderId);
            if (folder == null)
                return NotFound("Folder Not Found");

            var metadataObject = new
            {
                EyeSide = dto.EyeSide,
                Gender = dto.Gender,
                Age = dto.Age,
                city = dto.City,
                Status = dto.Status,
                profession = dto.Profession,
                notes = dto.Notes
            };

            var metadataJson = JsonSerializer.Serialize(metadataObject);

            var sample = new Sample
            {
                Title = dto.Title,
                Description = dto.Description,
                Metadata = metadataJson,
                FolderId = dto.FolderId,
                Files = new List<ResourceFile>()
            };

            _context.Samples.Add(sample);
            await _context.SaveChangesAsync();

            var uploadPath = Path.Combine(
                Directory.GetCurrentDirectory(),
                "Uploads",
                $"user-{folder.CreatedBy}",
                $"folder-{folder.Name}",
                $"sample-{sample.Title}"
            );

            Directory.CreateDirectory(uploadPath);

            foreach (var file in dto.Files)
            {
                try
                {
                    var result = await _fileService.SaveFileAsync(file, uploadPath);
                    var resourceFile = new ResourceFile
                    {
                        FileName = Path.GetFileName(result.path),
                        FilePath = result.path,
                        FileType = result.type,
                        SampleId = sample.Id,
                        Size = (int)file.Length,
                        UploadedBy = 0,
                        UploadedAt = DateTime.UtcNow,
                    };
                    sample.Files.Add(resourceFile);
                    _context.Files.Add(resourceFile);
                }
                catch (Exception ex)
                {
                    return BadRequest(ex.Message);
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new
            {
                message = "Sample created successfully",
                sampleId = sample.Id
            });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateSample(int id, [FromForm] UpdateSampleDto dto)
        {
            var sample = await _context.Samples
                .Include(s => s.Files)
                .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (sample == null)
                return NotFound();

            Folder? folder = null;
            if (dto.FolderId.HasValue)
            {
                folder = await _context.Folders.FirstOrDefaultAsync(f => f.Id == dto.FolderId.Value && !f.IsDeleted);
                if (folder == null)
                    return NotFound("Folder Not Found");

                sample.FolderId = dto.FolderId.Value;
            }
            else if (sample.FolderId.HasValue)
            {
                folder = await _context.Folders.FirstOrDefaultAsync(f => f.Id == sample.FolderId.Value && !f.IsDeleted);
            }

            var metadata = string.IsNullOrWhiteSpace(sample.Metadata)
                ? new Dictionary<string, object>()
                : JsonSerializer.Deserialize<Dictionary<string, object>>(sample.Metadata) ?? new Dictionary<string, object>();

            if (!string.IsNullOrWhiteSpace(dto.Title))
                sample.Title = dto.Title;

            if (dto.Description != null)
                sample.Description = dto.Description;

            if (!string.IsNullOrWhiteSpace(dto.EyeSide))
                metadata["EyeSide"] = dto.EyeSide;

            if (!string.IsNullOrWhiteSpace(dto.Gender))
                metadata["Gender"] = dto.Gender;

            if (dto.Age.HasValue)
                metadata["Age"] = dto.Age.Value;

            if (!string.IsNullOrWhiteSpace(dto.City))
                metadata["City"] = dto.City;

            if (!string.IsNullOrWhiteSpace(dto.Status))
                metadata["Status"] = dto.Status;

            if (!string.IsNullOrWhiteSpace(dto.Profession))
                metadata["Profession"] = dto.Profession;

            if (!string.IsNullOrWhiteSpace(dto.Notes))
                metadata["Notes"] = dto.Notes;

            sample.Metadata = JsonSerializer.Serialize(metadata);
            sample.UpdateAt = DateTime.UtcNow;

            var deletedFilesCount = 0;
            if (dto.DeletedFiles != null && dto.DeletedFiles.Any())
            {
                var filesToDelete = sample.Files
                    .Where(f => !f.IsDeleted && dto.DeletedFiles.Contains(f.Id))
                    .ToList();

                deletedFilesCount = filesToDelete.Count;

                foreach (var file in filesToDelete)
                {
                    file.IsDeleted = true;
                    file.DeletedAt = DateTime.UtcNow;

                    if (!string.IsNullOrWhiteSpace(file.FilePath) && System.IO.File.Exists(file.FilePath))
                    {
                        System.IO.File.Delete(file.FilePath);
                    }
                }
            }

            var addedFilesCount = 0;
            if (dto.NewFiles != null && dto.NewFiles.Any())
            {
                var folderSegment = folder != null ? $"folder-{folder.Name}" : "folder-unassigned";
                var uploadPath = Path.Combine(
                    Directory.GetCurrentDirectory(),
                    "Uploads",
                    folderSegment,
                    $"sample-{sample.Title}"
                );

                Directory.CreateDirectory(uploadPath);

                foreach (var file in dto.NewFiles)
                {
                    try
                    {
                        var result = await _fileService.SaveFileAsync(file, uploadPath);
                        var resourceFile = new ResourceFile
                        {
                            FileName = Path.GetFileName(result.path),
                            FilePath = result.path,
                            FileType = result.type,
                            SampleId = sample.Id,
                            Size = (int)file.Length,
                            UploadedBy = 0,
                            UploadedAt = DateTime.UtcNow,
                        };

                        sample.Files ??= new List<ResourceFile>();
                        sample.Files.Add(resourceFile);
                        _context.Files.Add(resourceFile);
                        addedFilesCount++;
                    }
                    catch (Exception ex)
                    {
                        return BadRequest(ex.Message);
                    }
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Sample updated successfully",
                sampleId = sample.Id,
                deletedFilesCount,
                addedFilesCount
            });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSample(int id)
        {
            var sample = await _context.Samples.Include(s => s.Files).FirstOrDefaultAsync(s => s.Id == id);

            if (sample == null)
                return NotFound();

            sample.IsDeleted = true;
            sample.DeletedAt = DateTime.UtcNow;

            foreach (var file in sample.Files ?? new List<ResourceFile>())
            {
                file.IsDeleted = true;
                file.DeletedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }


        [HttpPost("{id}/files/download")]
        public async Task<IActionResult> DownloadFiles(int id ,[FromBody] DownloadFilesDto dto)
        {
            if(dto.FileIds == null || !dto.FileIds.Any())
                return BadRequest("No files selected");

            var sample = await _context.Samples.Include(s => s.Files).FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (sample == null)
                return NotFound("Sample not found");
            
            var files = await _context.Files.Where(f => dto.FileIds.Contains(f.Id) && !f.IsDeleted && f.SampleId == id).ToListAsync();
            if(files.Count != dto.FileIds.Count)
                return BadRequest("Some files do not belong to this sample");
            
            if(!files.Any())
                return NotFound("No files found");

            using var memoryStream = new MemoryStream();

            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
            {
                foreach (var file in files)
                {
                    if(!System.IO.File.Exists(file.FilePath))
                        continue;
                    var entry = archive.CreateEntry(file.FileName);

                    using var entryStream = entry.Open();    
                    using FileStream fileStream = new FileStream(file.FilePath, FileMode.Open, FileAccess.Read);
                    
                    await fileStream.CopyToAsync(entryStream);
                    
                }
            }

            memoryStream.Position = 0;
            return File(memoryStream.ToArray(), "application/zip", $"sample-{id}-files.zip");
        }


        [HttpPost("{id}/download")]
        public async Task<IActionResult> DownloadSample(int id)
        {
            var sample = await _context.Samples.Include(s => s.Files).FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (sample == null)
                return NotFound("sample not found");

            using var memoryStream = new MemoryStream();

            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
            {
                var metadataEntry = archive.CreateEntry("metadata.txt");
                using (var entryStream = metadataEntry.Open())
                using (var streamWriter = new StreamWriter(entryStream))
                {
                    streamWriter.Write(sample.Metadata);
                }

                foreach (var file in sample.Files ?? new List<ResourceFile>())
                {
                    if (!System.IO.File.Exists(file.FilePath))
                        continue;

                    var entry = archive.CreateEntry(file.FileName);
                    using var entryStream = entry.Open();
                    using FileStream fileStream = new FileStream(file.FilePath, FileMode.Open, FileAccess.Read);
                    await fileStream.CopyToAsync(entryStream);
                }
            }

            memoryStream.Position = 0;
            return File(memoryStream.ToArray(), "application/zip", $"sample-{id}.zip");
        }
    
    }
}


