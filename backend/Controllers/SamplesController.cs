using System.IdentityModel.Tokens.Jwt;
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
using Xabe.FFmpeg;
using System.Net.Http.Headers;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SamplesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly FileService _fileService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _uploadsRoot;

        public SamplesController(AppDbContext context, FileService fileService, IHttpClientFactory httpClientFactory, IConfiguration config, IWebHostEnvironment env)
        {
            _context = context;
            _fileService = fileService;
            _httpClientFactory = httpClientFactory;

            var configured = config["Uploads:Path"] ?? config["UPLOADS_PATH"];
            _uploadsRoot = !string.IsNullOrWhiteSpace(configured)
                ? (Path.IsPathRooted(configured) ? configured : Path.Combine(env.ContentRootPath, configured))
                : Path.Combine(env.ContentRootPath, "Uploads");

            try { Directory.CreateDirectory(_uploadsRoot); } catch { }
        }

        private IQueryable<Sample> GetActiveSamplesQuery()
        {
            return _context.Samples
                .Where(s => !s.IsDeleted)
                .Include(s => s.CreatedByUser)
                .Include(s => s.Files.Where(f => !f.IsDeleted))
                .Include(s => s.Tags)
                .Include(s => s.Folder!).ThenInclude(f => f.Collection!);
        }

        private int GetCurrentUserId()
        {
            var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            return int.TryParse(userIdValue, out var userId) ? userId : 0;
        }

        private bool IsAdminUser() => User.IsInRole("Admin");

        private static bool IsPrivateCollection(Collection collection)
        {
            return collection.OwnerType == OwnerType.User &&
                   string.Equals(collection.Name, "Private Collection", StringComparison.OrdinalIgnoreCase);
        }

        private bool UserIsGroupMember(int userId, int groupId)
        {
            return _context.GroupMembers.Any(gm => gm.GroupId == groupId && gm.UserId == userId);
        }

        private bool UserIsGroupContributor(int userId, int groupId)
        {
            return _context.GroupMembers.Any(gm => gm.GroupId == groupId && gm.UserId == userId &&
                (gm.Role == GroupRole.Owner || gm.Role == GroupRole.Contributor));
        }

        private bool CanManageSample(Sample sample, int currentUserId)
        {
            if (IsAdminUser())
                return true;

            if (sample.Folder == null || sample.Folder.Collection == null)
                return false;

            if (sample.CreatedBy == currentUserId)
                return true;

            var collection = sample.Folder.Collection;
            if (collection.OwnerType == OwnerType.User && collection.OwnerId == currentUserId)
                return true;

            return collection.OwnerType == OwnerType.Group && UserIsGroupContributor(currentUserId, collection.OwnerId);
        }

        private string GetSampleMetadata(Sample sample)
        {
            return string.IsNullOrWhiteSpace(sample.Metadata) ? string.Empty : sample.Metadata!;
        }

        [HttpGet]
        public async Task<IActionResult> GetSamples()
        {
            var currentUserId = GetCurrentUserId();
            var query = GetActiveSamplesQuery();

            if (!IsAdminUser())
            {
                query = query.Where(s => s.Folder != null && s.Folder.Collection != null && (
                    (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.Name != "Private Collection") ||
                    (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.OwnerId == currentUserId) ||
                    (s.Folder.Collection.OwnerType == OwnerType.Group && _context.GroupMembers.Any(gm => gm.GroupId == s.Folder.Collection.OwnerId && gm.UserId == currentUserId))
                ));
            }

            var samples = await query.ToListAsync();
            return Ok(samples);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetSample(int id)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var query = GetActiveSamplesQuery().Where(s => s.Id == id);
                if (!IsAdminUser())
                {
                    query = query.Where(s => s.Folder != null && s.Folder.Collection != null && (
                        (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.Name != "Private Collection") ||
                        (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.OwnerId == currentUserId) ||
                        (s.Folder.Collection.OwnerType == OwnerType.Group && _context.GroupMembers.Any(gm => gm.GroupId == s.Folder.Collection.OwnerId && gm.UserId == currentUserId))
                    ));
                }

                var sample = await query.FirstOrDefaultAsync();
                if (sample == null)
                    return NotFound();

                sample.ViewCount++;
                await _context.SaveChangesAsync();

                return Ok(sample);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        [HttpPost("search")]
        public async Task<IActionResult> SearchSamples([FromBody] SearchSampleDto dto)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var query = GetActiveSamplesQuery();

                if (!IsAdminUser())
                {
                    query = query.Where(s => s.Folder != null && s.Folder.Collection != null && (
                        (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.Name != "Private Collection") ||
                        (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.OwnerId == currentUserId) ||
                        (s.Folder.Collection.OwnerType == OwnerType.Group && _context.GroupMembers.Any(gm => gm.GroupId == s.Folder.Collection.OwnerId && gm.UserId == currentUserId))
                    ));
                }

                var samples = await query.ToListAsync();
                var filtered = samples.AsEnumerable();

                if (dto.TagIds != null && dto.TagIds.Any())
                {
                    filtered = filtered.Where(s => s.Tags != null && dto.TagIds.All(tagId => s.Tags.Any(t => t.Id == tagId)));
                }

                if (dto.FileTypes != null && dto.FileTypes.Any())
                {
                    filtered = filtered.Where(s => s.Files != null && dto.FileTypes.Any(fileType =>
                        s.Files.Any(f => f.FileType.ToString().Equals(fileType, StringComparison.OrdinalIgnoreCase))));
                }

                if (!string.IsNullOrWhiteSpace(dto.Title))
                {
                    filtered = filtered.Where(s => !string.IsNullOrWhiteSpace(s.Title) && s.Title.Contains(dto.Title, StringComparison.OrdinalIgnoreCase));
                }

                if (!string.IsNullOrWhiteSpace(dto.Description))
                {
                    filtered = filtered.Where(s => !string.IsNullOrWhiteSpace(s.Description) && s.Description.Contains(dto.Description, StringComparison.OrdinalIgnoreCase));
                }

                if (!string.IsNullOrWhiteSpace(dto.EyeSide))
                {
                    filtered = filtered.Where(s => string.Equals(GetMetadataValue(s, "EyeSide"), dto.EyeSide, StringComparison.OrdinalIgnoreCase));
                }

                if (!string.IsNullOrWhiteSpace(dto.Gender))
                {
                    filtered = filtered.Where(s => string.Equals(GetMetadataValue(s, "Gender"), dto.Gender, StringComparison.OrdinalIgnoreCase));
                }

                if (!string.IsNullOrWhiteSpace(dto.City))
                {
                    filtered = filtered.Where(s => GetMetadataValue(s, "City")?.Contains(dto.City, StringComparison.OrdinalIgnoreCase) == true);
                }

                if (!string.IsNullOrWhiteSpace(dto.Condition))
                {
                    filtered = filtered.Where(s => GetMetadataValue(s, "Status")?.Contains(dto.Condition, StringComparison.OrdinalIgnoreCase) == true ||
                        (!string.IsNullOrWhiteSpace(s.Status) && s.Status.Contains(dto.Condition, StringComparison.OrdinalIgnoreCase)));
                }

                if (!string.IsNullOrWhiteSpace(dto.Status))
                {
                    filtered = filtered.Where(s => GetMetadataValue(s, "Status")?.Contains(dto.Status, StringComparison.OrdinalIgnoreCase) == true);
                }

                if (!string.IsNullOrWhiteSpace(dto.Profession))
                {
                    filtered = filtered.Where(s => GetMetadataValue(s, "Profession")?.Contains(dto.Profession, StringComparison.OrdinalIgnoreCase) == true);
                }

                if (!string.IsNullOrWhiteSpace(dto.Notes))
                {
                    filtered = filtered.Where(s => GetMetadataValue(s, "Notes")?.Contains(dto.Notes, StringComparison.OrdinalIgnoreCase) == true);
                }

                if (!string.IsNullOrWhiteSpace(dto.ContributorName))
                {
                    filtered = filtered.Where(s => s.CreatedByUser != null &&
                        (s.CreatedByUser.FirstName + " " + s.CreatedByUser.LastName)
                            .Contains(dto.ContributorName, StringComparison.OrdinalIgnoreCase));
                }

                if (!string.IsNullOrWhiteSpace(dto.MetadataKey) && !string.IsNullOrWhiteSpace(dto.MetadataValue))
                {
                    filtered = filtered.Where(s => GetMetadataValue(s, dto.MetadataKey)?.Contains(dto.MetadataValue, StringComparison.OrdinalIgnoreCase) == true);
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
            if (!string.IsNullOrWhiteSpace(sample.Metadata))
            {
                var metadataValue = TryGetMetadataValue(sample.Metadata, key);
                if (!string.IsNullOrWhiteSpace(metadataValue))
                    return metadataValue;
            }

            if (sample.Files != null)
            {
                foreach (var file in sample.Files)
                {
                    if (string.IsNullOrWhiteSpace(file.Metadata))
                        continue;

                    var metadataValue = TryGetMetadataValue(file.Metadata, key);
                    if (!string.IsNullOrWhiteSpace(metadataValue))
                        return metadataValue;
                }
            }

            return null;
        }

        private static string? TryGetMetadataValue(string json, string key)
        {
            try
            {
                var metadata = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);
                if (metadata == null)
                    return null;

                if (metadata.TryGetValue(key, out var value))
                    return ConvertJsonElementToString(value);

                foreach (var kvp in metadata)
                {
                    if (string.Equals(kvp.Key, key, StringComparison.OrdinalIgnoreCase))
                        return ConvertJsonElementToString(kvp.Value);
                }
            }
            catch
            {
            }

            return null;
        }

        private static string? ConvertJsonElementToString(JsonElement element)
        {
            return element.ValueKind switch
            {
                JsonValueKind.String => element.GetString(),
                JsonValueKind.Number => element.ToString(),
                JsonValueKind.True => "True",
                JsonValueKind.False => "False",
                _ => element.ToString()
            };
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

            if (sample.Files != null && sample.Files.Any(f => !string.IsNullOrWhiteSpace(f.Metadata) && f.Metadata.Contains(value, StringComparison.OrdinalIgnoreCase)))
                return true;

            if (sample.Tags != null && sample.Tags.Any(t => !string.IsNullOrWhiteSpace(t.Name) && t.Name.Contains(value, StringComparison.OrdinalIgnoreCase)))
                return true;

            if (sample.Files != null && sample.Files.Any(f => !string.IsNullOrWhiteSpace(f.FileName) && f.FileName.Contains(value, StringComparison.OrdinalIgnoreCase)))
                return true;

            // Enhanced file type search
            if (sample.Files != null)
            {
                if ((value == "image" || value == "images" || value == "photo" || value == "photos" || value == "picture" || value == "pictures") &&
                    sample.Files.Any(f => f.FileType == FileType.Image))
                    return true;
                if ((value == "video" || value == "videos" || value == "movie" || value == "movies") &&
                    sample.Files.Any(f => f.FileType == FileType.Video))
                    return true;
                if ((value == "document" || value == "documents" || value == "doc" || value == "docs" || value == "file" || value == "files") &&
                    sample.Files.Any(f => f.FileType == FileType.Document))
                    return true;
            }

            // Contributor name search
            if (sample.CreatedByUser != null)
            {
                var firstName = sample.CreatedByUser.FirstName ?? string.Empty;
                var lastName = sample.CreatedByUser.LastName ?? string.Empty;
                var fullName = $"{firstName} {lastName}".ToLowerInvariant();
                if (fullName.Contains(value) ||
                    firstName.Contains(value, StringComparison.OrdinalIgnoreCase) ||
                    lastName.Contains(value, StringComparison.OrdinalIgnoreCase))
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
                sampleQuery = sampleQuery.Where(s => s.Folder != null && s.Folder.Collection != null && (
                    (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.Name != "Private Collection") ||
                    (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.OwnerId == currentUserId) ||
                    (s.Folder.Collection.OwnerType == OwnerType.Group && _context.GroupMembers.Any(gm => gm.GroupId == s.Folder.Collection.OwnerId && gm.UserId == currentUserId))
                ));
            }

            var sample = await sampleQuery.FirstOrDefaultAsync();
            if (sample == null)
                return NotFound("Sample not found");

            var file = sample.Files?.FirstOrDefault(f => f.Id == fileId && !f.IsDeleted);
            if (file == null)
                return NotFound("File not found");

            if (string.IsNullOrWhiteSpace(file.FilePath))
                return NotFound("File content not found");

            var physicalPath = Path.IsPathRooted(file.FilePath) ? file.FilePath : Path.Combine(_uploadsRoot, file.FilePath);
            if (!System.IO.File.Exists(physicalPath))
                return NotFound("File content not found");

            var contentTypeProvider = new FileExtensionContentTypeProvider();
            var contentType = contentTypeProvider.TryGetContentType(file.FileName, out var resolvedType)
                ? resolvedType
                : "application/octet-stream";

            var stream = new FileStream(physicalPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            return File(stream, contentType);
        }

        [HttpPost("upload/sarab-ai")]
        [Authorize(Policy = "ContributorOrAdmin")]
        public async Task<IActionResult> UploadSampleSarabAi([FromForm] UploadSampleSarabAiDto dto)
        {
            if (dto.Videos == null || dto.Videos.Count < 2)
                return BadRequest(new { message = "At least one video is required." });

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
                Metadata = JsonSerializer.Serialize(metadataObject),
                CreatedAt = DateTime.UtcNow,
                Files = new List<ResourceFile>()
            };

            _context.Samples.Add(sample);
            await _context.SaveChangesAsync();

            var uploadPath = Path.Combine(_uploadsRoot, $"sample-{sample.Id}");
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

                    _context.Files.Add(new ResourceFile
                    {
                        FileName = targetFileName,
                        FilePath = Path.GetRelativePath(_uploadsRoot, filePath),
                        SampleId = sample.Id,
                        FileType = FileType.Video
                    });
                }

                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromMinutes(15);

                string visionApiUrl = "http://25.9.129.103:10000/api/Samples/maps";
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
                        if (!string.IsNullOrEmpty(result.trackingVideos.left2right))
                        {
                            var converted = await ProcessAndConvertVideo(result.trackingVideos.left2right, "tracked_lr", uploadPath, sample.Id);
                            result.trackingVideos.left2right = converted;
                        }

                        if (!string.IsNullOrEmpty(result.trackingVideos.right2left))
                        {
                            var converted = await ProcessAndConvertVideo(result.trackingVideos.right2left, "tracked_rl", uploadPath, sample.Id);
                            result.trackingVideos.right2left = converted;
                        }
                    }

                    await _context.SaveChangesAsync();

                    return Ok(new
                    {
                        sampleId = sample.Id,
                        message = "تمت المعالجة والتحويل بنجاح.",
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

        [HttpPost("upload")]
        [Authorize(Policy = "ContributorOrAdmin")]
        private async Task<string> ProcessAndConvertVideo(string base64Data, string fileNameNoExt, string uploadPath, int sampleId)
        {
            try
            {
                // تحديد مسار FFmpeg
                FFmpeg.SetExecutablesPath("/usr/bin");
                string cleanBase64 = base64Data.Contains(",") ? base64Data.Split(',')[1] : base64Data;
                var bytes = Convert.FromBase64String(cleanBase64);
                string mkvPath = Path.Combine(uploadPath, fileNameNoExt + ".mkv");
                string mp4Path = Path.Combine(uploadPath, fileNameNoExt + ".mp4");

                await System.IO.File.WriteAllBytesAsync(mkvPath, bytes);

                // حذف الملف القديم إن وجد
                if (System.IO.File.Exists(mp4Path)) System.IO.File.Delete(mp4Path);

                // تحويل صريح: hevc/gbrp → h264/yuv420p (متوافق مع جميع الأجهزة)
                var conversion = FFmpeg.Conversions.New()
                    .AddParameter($"-i \"{mkvPath}\"")
                    .AddParameter("-c:v libx264")
                    .AddParameter("-pix_fmt yuv420p")
                    .AddParameter("-crf 28")
                    .AddParameter("-preset fast")
                    .AddParameter("-movflags +faststart")
                    .SetOutput(mp4Path);
                await conversion.Start();

                if (!System.IO.File.Exists(mp4Path))
                    throw new Exception("FFmpeg conversion produced no output file");

                _context.Files.Add(new ResourceFile
                {
                    FileName = fileNameNoExt + ".mp4",
                    FilePath = Path.GetRelativePath(_uploadsRoot, mp4Path),
                    SampleId = sampleId,
                    FileType = FileType.Video
                });

                byte[] convertedBytes = await System.IO.File.ReadAllBytesAsync(mp4Path);

                if (System.IO.File.Exists(mkvPath)) System.IO.File.Delete(mkvPath);

                Console.WriteLine($"✅ Converted {fileNameNoExt} — MP4 size: {convertedBytes.Length} bytes");

                return Convert.ToBase64String(convertedBytes);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Conversion Error for {fileNameNoExt}: {ex.Message}");
                return string.Empty;
            }
        }
        
        private async Task SaveBase64File(string? base64Data, string fileName, string path, int sampleId)
        {
            if (string.IsNullOrEmpty(base64Data)) return;
            try
            {
                string cleanBase64 = base64Data.Contains(",") ? base64Data.Split(',')[1] : base64Data;
                var bytes = Convert.FromBase64String(cleanBase64);
                var filePath = Path.Combine(path, fileName);
                await System.IO.File.WriteAllBytesAsync(filePath, bytes);

                _context.Files.Add(new ResourceFile
                {
                    FileName = fileName,
                    FilePath = Path.GetRelativePath(_uploadsRoot, filePath),
                    SampleId = sampleId,
                    FileType = fileName.EndsWith(".png") ? FileType.Image : FileType.Video
                });
            }
            catch { }
        }

        [HttpPost("upload")]
        [Authorize(Policy = "ContributorOrAdmin")]
        public async Task<IActionResult> UploadSample([FromForm] CreateSampleDto dto)
        {
            var folder = await _context.Folders.FirstOrDefaultAsync(f => f.Id == dto.FolderId);
            if (folder == null)
                return NotFound("Folder Not Found");

            List<Dictionary<string, object>>? fileMetadataList = null;
            if (!string.IsNullOrWhiteSpace(dto.FileMetadataJson))
            {
                try
                {
                    fileMetadataList = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(dto.FileMetadataJson);
                }
                catch
                {
                    fileMetadataList = null;
                }
            }

            var currentUserId = GetCurrentUserId();

            var collection = await _context.Collections.FirstOrDefaultAsync(c => c.Id == folder.CollectionId && !c.IsDeleted);
            if (collection == null)
            {
                return BadRequest("Collection not found.");
            }

            if (!IsAdminUser() && collection.OwnerType == OwnerType.Group && !UserIsGroupContributor(currentUserId, collection.OwnerId))
            {
                return Forbid("Only group contributors can upload samples to this group collection.");
            }

            var sample = new Sample
            {
                Title = dto.Title,
                Description = dto.Description,
                FolderId = dto.FolderId,
                CreatedBy = currentUserId,
                Files = new List<ResourceFile>(),
                Tags = new List<Tag>()
            };

            if (dto.Tags != null && dto.Tags.Any())
            {
                foreach (var tagId in dto.Tags.Distinct())
                {
                    var existingTag = await _context.Tags.FirstOrDefaultAsync(t => t.Id == tagId);
                    if (existingTag != null)
                    {
                        sample.Tags.Add(existingTag);
                    }
                }
            }

            _context.Samples.Add(sample);
            await _context.SaveChangesAsync();

            var uploadPath = Path.Combine(_uploadsRoot, $"user-{folder.CreatedBy}", $"folder-{folder.Name}", $"sample-{sample.Title}");
            Directory.CreateDirectory(uploadPath);

            for (var fileIndex = 0; fileIndex < dto.Files.Count; fileIndex++)
            {
                var file = dto.Files[fileIndex];
                try
                {
                    var result = await _fileService.SaveFileAsync(file, uploadPath);
                    string? fileMetadataJson = null;
                    if (fileMetadataList != null && fileIndex < fileMetadataList.Count)
                    {
                        var metadataEntry = fileMetadataList[fileIndex];
                        if (metadataEntry.Any())
                        {
                            var normalizedMetadata = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                            foreach (var kvp in metadataEntry)
                            {
                                if (kvp.Value == null)
                                    continue;

                                var normalizedKey = kvp.Key switch
                                {
                                    "eyeSide" => "EyeSide",
                                    "gender" => "Gender",
                                    "age" => "Age",
                                    "city" => "City",
                                    "status" => "Status",
                                    "profession" => "Profession",
                                    "notes" => "Notes",
                                    _ => kvp.Key
                                };

                                normalizedMetadata[normalizedKey] = kvp.Value;
                            }

                            if (normalizedMetadata.Any())
                            {
                                fileMetadataJson = JsonSerializer.Serialize(normalizedMetadata);
                            }
                        }
                    }

                    var resourceFile = new ResourceFile
                    {
                        FileName = Path.GetFileName(result.path),
                        FilePath = Path.GetRelativePath(_uploadsRoot, result.path),
                        FileType = result.type,
                        SampleId = sample.Id,
                        Size = (int)file.Length,
                        UploadedBy = currentUserId,
                        UploadedAt = DateTime.UtcNow,
                        Metadata = fileMetadataJson
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
            return Ok(sample);
        }

        [HttpPut("{id}")]
        [Authorize(Policy = "ContributorOrAdmin")]
        public async Task<IActionResult> UpdateSample(int id, [FromForm] UpdateSampleDto dto)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == 0)
                return Unauthorized();

            var sample = await _context.Samples
                .Include(s => s.Files)
                .Include(s => s.Folder!).ThenInclude(f => f.Collection!)
                .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (sample == null)
                return NotFound();

            if (!CanManageSample(sample, currentUserId))
                return Forbid("You are not authorized to update this sample.");

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

            // Update metadata on the first file
            var firstFile = sample.Files?.FirstOrDefault(f => !f.IsDeleted);
            var metadata = new Dictionary<string, object>();
            string? existingMetadataJson = null;
            if (!string.IsNullOrWhiteSpace(sample.Metadata))
            {
                existingMetadataJson = sample.Metadata;
            }
            else if (firstFile != null && !string.IsNullOrWhiteSpace(firstFile.Metadata))
            {
                existingMetadataJson = firstFile.Metadata;
            }

            if (!string.IsNullOrWhiteSpace(existingMetadataJson))
            {
                metadata = JsonSerializer.Deserialize<Dictionary<string, object>>(existingMetadataJson) ?? new Dictionary<string, object>();
            }

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

            if (!string.IsNullOrWhiteSpace(sample.Metadata) || firstFile == null)
            {
                sample.Metadata = JsonSerializer.Serialize(metadata);
            }
            else if (firstFile != null)
            {
                firstFile.Metadata = JsonSerializer.Serialize(metadata);
            }

            if (!string.IsNullOrWhiteSpace(dto.Title))
                sample.Title = dto.Title;

            if (dto.Description != null)
                sample.Description = dto.Description;

            sample.UpdateAt = DateTime.UtcNow;

            var deletedFilesCount = 0;
            if (dto.DeletedFiles != null && dto.DeletedFiles.Any())
            {
                var filesToDelete = sample.Files?.Where(f => !f.IsDeleted && dto.DeletedFiles.Contains(f.Id)).ToList() ?? new List<ResourceFile>();

                deletedFilesCount = filesToDelete.Count;

                foreach (var file in filesToDelete)
                {
                    file.IsDeleted = true;
                    file.DeletedAt = DateTime.UtcNow;

                    if (!string.IsNullOrWhiteSpace(file.FilePath))
                    {
                        var physical = Path.IsPathRooted(file.FilePath) ? file.FilePath : Path.Combine(_uploadsRoot, file.FilePath);
                        if (System.IO.File.Exists(physical))
                        {
                            try { System.IO.File.Delete(physical); } catch { }
                        }
                    }
                }
            }

            var addedFilesCount = 0;
            if (dto.NewFiles != null && dto.NewFiles.Any())
            {
                var folderSegment = folder != null ? $"folder-{folder.Name}" : "folder-unassigned";
                var uploadPath = Path.Combine(_uploadsRoot, folderSegment, $"sample-{sample.Title}");
                Directory.CreateDirectory(uploadPath);

                foreach (var file in dto.NewFiles)
                {
                    try
                    {
                        var result = await _fileService.SaveFileAsync(file, uploadPath);
                        var resourceFile = new ResourceFile
                        {
                            FileName = Path.GetFileName(result.path),
                            FilePath = Path.GetRelativePath(_uploadsRoot, result.path),
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
        [Authorize(Policy = "ContributorOrAdmin")]
        public async Task<IActionResult> DeleteSample(int id)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == 0)
                return Unauthorized();

            var sample = await _context.Samples
                .Include(s => s.Files)
                .Include(s => s.Folder!).ThenInclude(f => f.Collection!)
                .FirstOrDefaultAsync(s => s.Id == id);

            if (sample == null)
                return NotFound();

            if (!CanManageSample(sample, currentUserId))
                return Forbid("You are not authorized to delete this sample.");

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

            var currentUserId = GetCurrentUserId();
            var sample = await _context.Samples
                .Include(s => s.Files)
                .Include(s => s.Folder!).ThenInclude(f => f.Collection!)
                .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (sample == null)
                return NotFound("Sample not found");

            if (!IsAdminUser())
            {
                var collection = sample.Folder?.Collection;
                if (collection == null ||
                    !((collection.OwnerType == OwnerType.User && collection.Name != "Private Collection") ||
                      (collection.OwnerType == OwnerType.User && collection.OwnerId == currentUserId) ||
                      (collection.OwnerType == OwnerType.Group && UserIsGroupMember(currentUserId, collection.OwnerId))))
                {
                    return NotFound("Sample not found");
                }
            }
            
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
                    var physicalPath = Path.IsPathRooted(file.FilePath) ? file.FilePath : Path.Combine(_uploadsRoot, file.FilePath);
                    if(!System.IO.File.Exists(physicalPath))
                        continue;
                    var entry = archive.CreateEntry(file.FileName);
                    using (var entryStream = entry.Open())
                    using (FileStream fileStream = new FileStream(physicalPath, FileMode.Open, FileAccess.Read))
                    {
                        await fileStream.CopyToAsync(entryStream);
                    }
                }
            }

            sample.DownloadCount++;
            await _context.SaveChangesAsync();

            memoryStream.Position = 0;
            return File(memoryStream.ToArray(), "application/zip", $"sample-{id}-files.zip");
        }


        [HttpPost("download")]
        public async Task<IActionResult> DownloadSamples([FromBody] DownloadSamplesDto dto)
        {
            if (dto.SampleIds == null || !dto.SampleIds.Any())
                return BadRequest("No samples selected");

            var currentUserId = GetCurrentUserId();
            var query = GetActiveSamplesQuery().Where(s => dto.SampleIds.Contains(s.Id));
            if (!IsAdminUser())
            {
                query = query.Where(s => s.Folder != null && s.Folder.Collection != null && (
                    (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.Name != "Private Collection") ||
                    (s.Folder.Collection.OwnerType == OwnerType.User && s.Folder.Collection.OwnerId == currentUserId) ||
                    (s.Folder.Collection.OwnerType == OwnerType.Group && _context.GroupMembers.Any(gm => gm.GroupId == s.Folder.Collection.OwnerId && gm.UserId == currentUserId))
                ));
            }

            var samples = await query.ToListAsync();
            var distinctRequested = dto.SampleIds.Distinct().Count();
            if (samples.Count != distinctRequested)
                return BadRequest("Some samples were not found or are not accessible.");

            using var memoryStream = new MemoryStream();
            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
            {
                    foreach (var sample in samples)
                {
                    var sampleFolder = $"sample-{sample.Id}";
                    var metadataText = GetSampleMetadata(sample);
                    if (!string.IsNullOrWhiteSpace(metadataText))
                    {
                        var metadataEntry = archive.CreateEntry($"{sampleFolder}/metadata.txt");
                        using (var entryStream = metadataEntry.Open())
                        using (var streamWriter = new StreamWriter(entryStream))
                        {
                            streamWriter.Write(metadataText);
                        }
                    }

                    foreach (var file in sample.Files ?? new List<ResourceFile>())
                    {
                        var physicalPath = Path.IsPathRooted(file.FilePath) ? file.FilePath : Path.Combine(_uploadsRoot, file.FilePath);
                        if (!System.IO.File.Exists(physicalPath))
                            continue;

                        var entry = archive.CreateEntry($"{sampleFolder}/{file.FileName}");
                        using (var entryStream = entry.Open())
                        using (FileStream fileStream = new FileStream(physicalPath, FileMode.Open, FileAccess.Read))
                        {
                            await fileStream.CopyToAsync(entryStream);
                        }

                        if (!string.IsNullOrWhiteSpace(file.Metadata))
                        {
                            var metaEntry = archive.CreateEntry($"{sampleFolder}/{file.FileName}.metadata.json");
                            using (var mStream = metaEntry.Open())
                            using (var writer = new StreamWriter(mStream))
                            {
                                writer.Write(file.Metadata);
                            }
                        }
                    }
                }
            }

            foreach (var sample in samples)
            {
                sample.DownloadCount++;
            }

            await _context.SaveChangesAsync();

            memoryStream.Position = 0;
            return File(memoryStream.ToArray(), "application/zip", "samples.zip");
        }

        [HttpPost("{id}/download")]
        public async Task<IActionResult> DownloadSample(int id)
        {
            var currentUserId = GetCurrentUserId();
            var sample = await _context.Samples
                .Include(s => s.Files)
                .Include(s => s.Folder!).ThenInclude(f => f.Collection!)
                .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (sample == null)
                return NotFound("Sample not found");

            if (!IsAdminUser())
            {
                var collection = sample.Folder?.Collection;
                if (collection == null ||
                    !((collection.OwnerType == OwnerType.User && collection.Name != "Private Collection") ||
                      (collection.OwnerType == OwnerType.User && collection.OwnerId == currentUserId) ||
                      (collection.OwnerType == OwnerType.Group && UserIsGroupMember(currentUserId, collection.OwnerId))))
                {
                    return NotFound("Sample not found");
                }
            }

            using var memoryStream = new MemoryStream();

            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
            {
                var metadataText = GetSampleMetadata(sample);
                if (!string.IsNullOrWhiteSpace(metadataText))
                {
                    var metadataEntry = archive.CreateEntry("metadata.txt");
                    using (var entryStream = metadataEntry.Open())
                    using (var streamWriter = new StreamWriter(entryStream))
                    {
                        streamWriter.Write(metadataText);
                    }
                }

                foreach (var file in sample.Files ?? new List<ResourceFile>())
                {
                    var physicalPath = Path.IsPathRooted(file.FilePath) ? file.FilePath : Path.Combine(_uploadsRoot, file.FilePath);
                    if (!System.IO.File.Exists(physicalPath))
                        continue;

                    var entry = archive.CreateEntry(file.FileName);
                    using (var entryStream = entry.Open())
                    using (FileStream fileStream = new FileStream(physicalPath, FileMode.Open, FileAccess.Read))
                    {
                        await fileStream.CopyToAsync(entryStream);
                    }

                    if (!string.IsNullOrWhiteSpace(file.Metadata))
                    {
                        var metaEntry = archive.CreateEntry($"{file.FileName}.metadata.json");
                        using (var mStream = metaEntry.Open())
                        using (var writer = new StreamWriter(mStream))
                        {
                            writer.Write(file.Metadata);
                        }
                    }
                }
            }

            sample.DownloadCount++;
            await _context.SaveChangesAsync();

            memoryStream.Position = 0;
            return File(memoryStream.ToArray(), "application/zip", $"sample-{id}.zip");
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


