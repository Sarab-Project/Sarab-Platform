using Microsoft.AspNetCore.Mvc;
using SarabPlatform.Data;
using SarabPlatform.Dto;
using SarabPlatform.Models;
using SarabPlatform.Enum;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SarabPlatform.Services;
using System.IO.Compression;
using System.Net.Http.Headers;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SamplesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly FileService _fileService;
        
        private readonly IHttpClientFactory _httpClientFactory;

        public SamplesController(AppDbContext context, FileService fileService, IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _fileService = fileService;
            _httpClientFactory = httpClientFactory;

        }

        private IQueryable<Sample> GetActiveSamplesQuery()
        {
            return _context.Samples
                .Where(s => !s.IsDeleted)
                .Include(s => s.Files.Where(f => !f.IsDeleted))
                .Include(s => s.Tags);
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
        if (dto.Videos == null || dto.Videos.Count < 2)
            return BadRequest(new { message = "يجب رفع فيديوهين على الأقل (يسار-يمين ويمين-يسار)." });

        var metadataObject = new
        {
            EyeSide = dto.EyeSide,
            Gender = dto.Gender,
            Age = dto.Age,
            City = dto.City,
            Status = dto.Status,
            Profession = dto.Profession,
            Notes = dto.Notes
        };

        var sample = new Sample
        {
            Title = "Sarab-Ai Analysis " + DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
            Age = dto.Age,
            Gender = dto.Gender,
            City = dto.City ?? string.Empty,        
            Status = dto.Status ?? string.Empty,    
            Notes = dto.Notes ?? string.Empty,      
            Metadata = JsonSerializer.Serialize(metadataObject),
            CreatedAt = DateTime.UtcNow,
            Files = new List<ResourceFile>()
        };

        _context.Samples.Add(sample);
        await _context.SaveChangesAsync();

        var uploadPath = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", $"sample-{sample.Id}");
        if (!Directory.Exists(uploadPath)) Directory.CreateDirectory(uploadPath);

        var streamsToDispose = new List<Stream>();

        try
        {
            using var multipartContent = new MultipartFormDataContent();

            for (int i = 0; i < dto.Videos.Count; i++)
            {
                var file = dto.Videos[i];
                string targetFileName = (i == 0) ? "left2right.mp4" : "right2left.mp4";
                string fieldName = (i == 0) ? "left2right" : "right2left";
                var filePath = Path.Combine(uploadPath, targetFileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var fileStreamForUpload = new FileStream(filePath, FileMode.Open, FileAccess.Read);
                streamsToDispose.Add(fileStreamForUpload); 

                var fileContent = new StreamContent(fileStreamForUpload);
                fileContent.Headers.ContentType = new MediaTypeHeaderValue("video/mp4");
                
                multipartContent.Add(fileContent, fieldName, targetFileName);

                _context.Files.Add(new ResourceFile {
                    FileName = targetFileName,
                    FilePath = filePath,
                    SampleId = sample.Id,
                    FileType = FileType.Video
                });
            }

            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromMinutes(15); 

            string visionApiUrl = "http://25.9.129.103:8000/api/Samples/maps";
            var response = await client.PostAsync(visionApiUrl, multipartContent);

            if (response.IsSuccessStatusCode)
            {
                var resultJson = await response.Content.ReadAsStringAsync();
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var result = JsonSerializer.Deserialize<VisionServiceResponse>(resultJson, options);

                if (result?.maps != null)
                {
                    await SaveBase64File(result.maps.fullMap, "merged_heatmap.png", uploadPath, sample.Id);
                    await SaveBase64File(result.maps.left2right, "heatmap_lr.png", uploadPath, sample.Id);
                    await SaveBase64File(result.maps.right2left, "heatmap_rl.png", uploadPath, sample.Id);
                }

                if (result?.trackingVideos != null)
                {
                    await SaveBase64File(result.trackingVideos.left2right, "tracked_lr.mkv", uploadPath, sample.Id);
                    await SaveBase64File(result.trackingVideos.right2left, "tracked_rl.mkv", uploadPath, sample.Id);
                }

                await _context.SaveChangesAsync();

                return Ok(new { 
                    sampleId = sample.Id, 
                    message = "تمت المعالجة بنجاح واستلام النتائج.",
                    results = result 
                });
            }
            else
            {
                var errorMsg = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { message = "فشلت خدمة المعالجة في بايثون", details = errorMsg });
            }
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "خطأ أثناء التواصل مع خدمة الـ AI", error = ex.Message });
        }
        finally
        {
            foreach (var s in streamsToDispose)
            {
                await s.DisposeAsync();
            }
        }
    }

    private async Task SaveBase64File(string base64Data, string fileName, string path, int sampleId)
    {
        if (string.IsNullOrEmpty(base64Data)) return;

        try 
        {
            string cleanBase64 = base64Data.Contains(",") ? base64Data.Split(',')[1] : base64Data;
            var bytes = Convert.FromBase64String(cleanBase64);
            
            var filePath = Path.Combine(path, fileName);
            await System.IO.File.WriteAllBytesAsync(filePath, bytes);

            _context.Files.Add(new ResourceFile {
                FileName = fileName,
                FilePath = filePath,
                SampleId = sampleId,
                FileType = fileName.EndsWith(".png") ? FileType.Image : FileType.Video  // ✅ fixed
            });
        }
        catch (Exception)
        {
            
        }
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
                City = dto.City,
                Status = dto.Status,
                Profession = dto.Profession,
                Notes = dto.Notes
            };

            var metadataJson = JsonSerializer.Serialize(metadataObject);

            var sample = new Sample
            {
                Title = dto.Title,
                Description = dto.Description,
                Metadata = metadataJson,
                FolderId = dto.FolderId,
                Gender = dto.Gender,
                Age = dto.Age,
                City = dto.City ?? string.Empty,
                Status = dto.Status ?? string.Empty,
                Notes = dto.Notes ?? string.Empty,
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

            sample.DownloadCount++;
            await _context.SaveChangesAsync();
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
            sample.DownloadCount++;
            await _context.SaveChangesAsync();
            memoryStream.Position = 0;
            return File(memoryStream.ToArray(), "application/zip", $"sample-{id}.zip");
        }
        

        [HttpPut("{id}/add-tags")]
        public async Task<IActionResult> AddTagsToSample(int id, AddTagsDto dto)
        {
            var sample = await _context.Samples.Include(s => s.Tags).FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);
            if (sample == null)
                return NotFound("Sample not found");

            var tagsToAdd = await _context.Tags.Where(t => dto.TagIds.Contains(t.Id)).ToListAsync();
            if (tagsToAdd.Count != dto.TagIds.Count)
                return BadRequest("Some tags not found");

            foreach (var tag in tagsToAdd)
            {
                if (!sample.Tags.Any(t => t.Id == tag.Id))
                {
                    sample.Tags.Add(tag);
                    tag.Samples.Add(sample);
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Tags added to sample successfully" });
        }

        [HttpPut("{id}/remove-tags")]
        public async Task<IActionResult> RemoveTagsFromSample(int id, AddTagsDto dto)
        {
            var sample = await _context.Samples.Include(s => s.Tags).FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);
            if (sample == null)
                return NotFound("Sample not found");

            var tagsToRemove = await _context.Tags.Where(t => dto.TagIds.Contains(t.Id)).ToListAsync();
            if (tagsToRemove.Count != dto.TagIds.Count)
                return BadRequest("Some tags not found");

            foreach (var tag in tagsToRemove)
            {
                sample.Tags.Remove(tag);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Tags removed from sample successfully" });
        }

        [HttpPost("search")]
        public async Task<IActionResult> Search([FromBody] SearchSampleDto dto)
        {
            try
            {
                // Validate pagination parameters
                if (dto.Page < 1) dto.Page = 1;
                if (dto.PageSize < 1 || dto.PageSize > 100) dto.PageSize = 10;

                // Build the query with includes
                var query = _context.Samples
                    .Include(s => s.Files.Where(f => !f.IsDeleted))
                    .Include(s => s.Tags)
                    .Where(s => !s.IsDeleted)
                    .AsQueryable();

                // Apply filters
                if (!string.IsNullOrWhiteSpace(dto.Gender))
                    query = query.Where(s => s.Gender == dto.Gender);

                if (dto.MinAge > 0)
                    query = query.Where(s => s.Age >= dto.MinAge);

                if (dto.MaxAge > 0)
                    query = query.Where(s => s.Age <= dto.MaxAge);

                if (!string.IsNullOrWhiteSpace(dto.City))
                    query = query.Where(s => !string.IsNullOrEmpty(s.City) && s.City.Contains(dto.City));

                if (!string.IsNullOrWhiteSpace(dto.Status))
                    query = query.Where(s => !string.IsNullOrEmpty(s.Status) && s.Status.Contains(dto.Status));

                if (!string.IsNullOrWhiteSpace(dto.Keyword))
                    query = query.Where(s =>
                        (!string.IsNullOrEmpty(s.Title) && s.Title.Contains(dto.Keyword)) ||
                        (!string.IsNullOrEmpty(s.Notes) && s.Notes.Contains(dto.Keyword)) ||
                        (!string.IsNullOrEmpty(s.City) && s.City.Contains(dto.Keyword)) ||
                        (!string.IsNullOrEmpty(s.Status) && s.Status.Contains(dto.Keyword)) ||
                        (!string.IsNullOrEmpty(s.Description) && s.Description.Contains(dto.Keyword))
                    );

                if (dto.TagIds != null && dto.TagIds.Any())
                    query = query.Where(s => s.Tags.Any(t => dto.TagIds.Contains(t.Id)));

                // Order results
                query = query.OrderByDescending(s => s.CreatedAt);

                // Get total count
                var total = await query.CountAsync();
                var totalPages = (int)Math.Ceiling(total / (double)dto.PageSize);

                // Get paginated results
                var samples = await query
                    .Skip((dto.Page - 1) * dto.PageSize)
                    .Take(dto.PageSize)
                    .ToListAsync();

                // Map to response DTOs
                var sampleDtos = samples.Select(s => new SampleResponseDto
                {
                    Id = s.Id,
                    Title = s.Title,
                    Description = s.Description,
                    CreatedBy = s.CreatedBy,
                    DownloadCount = s.DownloadCount,
                    Gender = s.Gender,
                    Age = s.Age,
                    City = s.City,
                    Status = s.Status,
                    Notes = s.Notes,
                    CreatedAt = s.CreatedAt,
                    Files = s.Files?.Select(f => new ResourceFileDto
                    {
                        Id = f.Id,
                        FileName = f.FileName,
                        FileType = f.FileType.ToString(),
                        Size = f.Size,
                        CreatedAt = f.CreatedAt
                    }).ToList() ?? new(),
                    Tags = s.Tags?.Select(t => new TagDto
                    {
                        Id = t.Id,
                        Name = t.Name
                    }).ToList() ?? new()
                }).ToList();

                var response = new PaginatedResponseDto<SampleResponseDto>
                {
                    Total = total,
                    Page = dto.Page,
                    PageSize = dto.PageSize,
                    TotalPages = totalPages,
                    HasNextPage = dto.Page < totalPages,
                    HasPreviousPage = dto.Page > 1,
                    Data = sampleDtos
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error occurred while searching samples", error = ex.Message });
            }
        }

       public class VisionServiceResponse
        {
            public TrackingVideos? trackingVideos { get; set; }
            public Maps? maps { get; set; }
        }

        public class TrackingVideos
        {
            public string? left2right { get; set; }
            public string? right2left { get; set; }
        }

        public class Maps
        {
            public string? left2right { get; set; }
            public string? right2left { get; set; }
            public string? fullMap { get; set; }
        }
    
    }
}
