using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using SarabPlatform.Data;
using SarabPlatform.Dto;
using SarabPlatform.Models;
using SarabPlatform.Enum;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SarabPlatform.Services;
using SarabPlatform.DTO;
using System.IO.Compression;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
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
                .Include(s => s.Files.Where(f => !f.IsDeleted))
                .Include(s => s.Tags)
                .Include(s => s.Folder!).ThenInclude(f => f.Collection!);
        }

        private int GetCurrentUserId()
        {
            var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            return int.TryParse(userIdValue, out var userId) ? userId : 0;
        }

        private bool IsAdminUser() => User.IsInRole("Admin");

        private static bool IsPrivateCollection(Collection collection)
        {
            return string.Equals(collection.Name, "Private", StringComparison.OrdinalIgnoreCase);
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetSamples()
        {
            var currentUserId = GetCurrentUserId();
            var query = GetActiveSamplesQuery();

            if (!IsAdminUser())
            {
                query = query.Where(s => s.Folder != null && s.Folder.Collection != null && (s.Folder.Collection.Name != "Private" || (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.OwnerId == currentUserId)));
            }

            var samples = await query.ToListAsync();
            return Ok(samples);
        }

        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetSample(int id)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var query = GetActiveSamplesQuery().Where(s => s.Id == id);
                if (!IsAdminUser())
                {
                    query = query.Where(s => s.Folder != null && s.Folder.Collection != null && (s.Folder.Collection.Name != "Private" || (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.OwnerId == currentUserId)));
                }

                var sample = await query.FirstOrDefaultAsync();
                if (sample == null)
                    return NotFound();

                return Ok(sample);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        [HttpPost("search")]
        [AllowAnonymous]
        public async Task<IActionResult> SearchSamples([FromBody] SearchSampleDto dto)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var query = GetActiveSamplesQuery();

                if (!IsAdminUser())
                {
                    query = query.Where(s => s.Folder != null && s.Folder.Collection != null &&
                        (s.Folder.Collection.Name != "Private" ||
                         (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.OwnerId == currentUserId)));
                }

                var samples = await query.ToListAsync();
                var filtered = samples.AsEnumerable();

                if (dto.TagIds != null && dto.TagIds.Any())
                {
                    filtered = filtered.Where(s => s.Tags != null && dto.TagIds.All(tagId => s.Tags.Any(t => t.Id == tagId)));
                }

                if (!string.IsNullOrWhiteSpace(dto.Gender))
                {
                    filtered = filtered.Where(s => string.Equals(GetMetadataValue(s, "Gender"), dto.Gender, StringComparison.OrdinalIgnoreCase));
                }

                if (!string.IsNullOrWhiteSpace(dto.City))
                {
                    filtered = filtered.Where(s => GetMetadataValue(s, "City")?.Contains(dto.City, StringComparison.OrdinalIgnoreCase) == true);
                }

                if (!string.IsNullOrWhiteSpace(dto.Status))
                {
                    filtered = filtered.Where(s => GetMetadataValue(s, "Status")?.Contains(dto.Status, StringComparison.OrdinalIgnoreCase) == true);
                }

                if (dto.MinAge.HasValue)
                {
                    filtered = filtered.Where(s => s.Age.HasValue && s.Age.Value >= dto.MinAge.Value);
                }

                if (dto.MaxAge.HasValue)
                {
                    filtered = filtered.Where(s => s.Age.HasValue && s.Age.Value <= dto.MaxAge.Value);
                }

                if (!string.IsNullOrWhiteSpace(dto.Keyword))
                {
                    var terms = dto.Keyword
                        .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                        .Select(t => t.Trim())
                        .Where(t => !string.IsNullOrWhiteSpace(t))
                        .ToList();

                    var requiredTerms = terms.Where(t => t.StartsWith("+")).Select(t => t.TrimStart('+')).Where(t => !string.IsNullOrWhiteSpace(t)).ToList();
                    var optionalTerms = terms.Where(t => !t.StartsWith("+")).Select(t => t.StartsWith("*") ? t.TrimStart('*') : t).Where(t => !string.IsNullOrWhiteSpace(t)).ToList();

                    foreach (var term in requiredTerms)
                    {
                        filtered = filtered.Where(s => SampleMatchesTerm(s, term));
                    }

                    if (optionalTerms.Any())
                    {
                        filtered = filtered.Where(s => optionalTerms.Any(term => SampleMatchesTerm(s, term)));
                    }
                }

                var page = dto.Page.GetValueOrDefault(1);
                var pageSize = Math.Clamp(dto.PageSize.GetValueOrDefault(50), 1, 100);
                filtered = filtered.Skip((page - 1) * pageSize).Take(pageSize);

                return Ok(filtered.ToList());
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Search failed", error = ex.Message });
            }
        }

        private static string? GetMetadataValue(Sample sample, string key)
        {
            if (string.IsNullOrWhiteSpace(sample.Metadata))
                return null;

            try
            {
                var metadata = JsonSerializer.Deserialize<Dictionary<string, object>>(sample.Metadata);
                if (metadata != null && metadata.TryGetValue(key, out var value))
                {
                    return value?.ToString();
                }
            }
            catch
            {
            }

            return null;
        }

        private static bool SampleMatchesTerm(Sample sample, string rawTerm)
        {
            var term = rawTerm.Trim();
            if (string.IsNullOrWhiteSpace(term))
                return true;

            var value = term.Trim().ToLowerInvariant();
            if (value.StartsWith("#"))
                value = value.Substring(1);

            if (!string.IsNullOrWhiteSpace(sample.Title) && sample.Title.Contains(value, StringComparison.OrdinalIgnoreCase))
                return true;

            if (!string.IsNullOrWhiteSpace(sample.Description) && sample.Description.Contains(value, StringComparison.OrdinalIgnoreCase))
                return true;

            if (!string.IsNullOrWhiteSpace(sample.Metadata) && sample.Metadata.Contains(value, StringComparison.OrdinalIgnoreCase))
                return true;

            if (sample.Tags != null && sample.Tags.Any(t => !string.IsNullOrWhiteSpace(t.Name) && t.Name.Contains(value, StringComparison.OrdinalIgnoreCase)))
                return true;

            if (sample.Files != null && sample.Files.Any(f => !string.IsNullOrWhiteSpace(f.FileName) && f.FileName.Contains(value, StringComparison.OrdinalIgnoreCase)))
                return true;

            if (sample.Files != null)
            {
                if ((value == "image" || value == "images") && sample.Files.Any(f => f.FileType == FileType.Image))
                    return true;
                if ((value == "video" || value == "videos") && sample.Files.Any(f => f.FileType == FileType.Video))
                    return true;
                if ((value == "document" || value == "documents") && sample.Files.Any(f => f.FileType == FileType.Document))
                    return true;
            }

            return false;
        }

        [HttpGet("{sampleId}/files/{fileId}")]
        public async Task<IActionResult> GetSampleFile(int sampleId, int fileId)
        {
            var currentUserId = GetCurrentUserId();
            var sampleQuery = GetActiveSamplesQuery().Where(s => s.Id == sampleId);
            if (!IsAdminUser())
            {
                sampleQuery = sampleQuery.Where(s => s.Folder != null && s.Folder.Collection != null && (s.Folder.Collection.Name != "Private" || (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.OwnerId == currentUserId)));
            }

            var sample = await sampleQuery.FirstOrDefaultAsync();
            if (sample == null)
                return NotFound("Sample not found");

            var file = sample.Files?.FirstOrDefault(f => f.Id == fileId && !f.IsDeleted);
            if (file == null)
                return NotFound("File not found");

            if (string.IsNullOrWhiteSpace(file.FilePath) || !System.IO.File.Exists(file.FilePath))
                return NotFound("File content not found");

            var contentTypeProvider = new FileExtensionContentTypeProvider();
            var contentType = contentTypeProvider.TryGetContentType(file.FileName, out var resolvedType)
                ? resolvedType
                : "application/octet-stream";

            var stream = new FileStream(file.FilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            return File(stream, contentType);
        }

        [HttpPost("upload/sarab-ai")]
        [Authorize(Policy = "ContributorOrAdmin")]
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

            var currentUserId = GetCurrentUserId();
            var sample = new Sample
            {
                Title = "Sarab-Ai",
                Metadata = metadataJson,
                CreatedBy = currentUserId,
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
                    UploadedBy = currentUserId,
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
        [Authorize(Policy = "ContributorOrAdmin")]
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

            var currentUserId = GetCurrentUserId();
            var sample = new Sample
            {
                Title = dto.Title,
                Description = dto.Description,
                Metadata = metadataJson,
                FolderId = dto.FolderId,
                CreatedBy = currentUserId,
                Files = new List<ResourceFile>(),
                Tags = new List<Tag>()
            };

            if (dto.Tags != null && dto.Tags.Any())
            {
                foreach (var rawTag in dto.Tags.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim()).Distinct(StringComparer.OrdinalIgnoreCase))
                {
                    var existingTag = await _context.Tags.FirstOrDefaultAsync(t => t.Name == rawTag);
                    if (existingTag != null)
                    {
                        sample.Tags.Add(existingTag);
                    }
                    else
                    {
                        var newTag = new Tag { Name = rawTag };
                        sample.Tags.Add(newTag);
                        _context.Tags.Add(newTag);
                    }
                }
            }

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
                        UploadedBy = currentUserId,
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


