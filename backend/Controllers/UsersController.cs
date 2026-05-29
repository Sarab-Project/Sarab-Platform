using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SarabPlatform.Data;
using SarabPlatform.Models;
using SarabPlatform.Dto;
using SarabPlatform.Enum;
using System.Security.Cryptography;
using System.Runtime.Intrinsics.Arm;
using System.Text;
using Microsoft.EntityFrameworkCore;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "AdminOnly")]
 public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public ActionResult GetUsers()
        {
            var users = _context.Users
                .Include(u => u.UserSessions)
                .Select(u => new
                {
                    u.Id,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                    u.Role,
                    u.IsActive,
                    u.IsVerified,
                    u.IsEmailVerified,
                    u.CreatedAt,
                    u.UpdatedAt,
                    LastLogin = u.UserSessions.OrderByDescending(s => s.LastLogin).Select(s => s.LastLogin).FirstOrDefault(),
                    ActiveSessions = u.UserSessions.Count(s => !s.IsRevoked && s.ExpiresAt > DateTime.UtcNow),
                    TotalSessions = u.UserSessions.Count()
                })
                .ToList();

            return Ok(users);
        }

        [HttpGet("{id}")]
        public ActionResult GetUser(int id)
        {
            try
            {
                var user = _context.Users
                    .Include(u => u.UserSessions)
                    .FirstOrDefault(u => u.Id == id);
                if (user == null)
                    return NotFound();

                var latestSession = user.UserSessions?
                    .OrderByDescending(s => s.LastLogin)
                    .Select(s => new
                    {
                        s.LastLogin,
                        s.IpAddress,
                        s.DeviceInfo,
                        s.ExpiresAt,
                        s.IsRevoked
                    })
                    .FirstOrDefault();

                return Ok(new
                {
                    user.Id,
                    user.FirstName,
                    user.LastName,
                    user.Email,
                    user.Role,
                    user.IsActive,
                    user.IsVerified,
                    user.IsEmailVerified,
                    user.CreatedAt,
                    user.UpdatedAt,
                    LastLogin = latestSession?.LastLogin,
                    LatestSessionIp = latestSession?.IpAddress,
                    LatestSessionDevice = latestSession?.DeviceInfo,
                    LatestSessionExpiresAt = latestSession?.ExpiresAt,
                    LatestSessionRevoked = latestSession?.IsRevoked,
                    TotalSessions = user.UserSessions?.Count ?? 0
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        [HttpPost]
        public ActionResult<User> CreateUser(CreateUserDto dto)
        {
            if (!System.Enum.TryParse<UserRole>(dto.Role, true, out var parsedRole) || parsedRole == UserRole.Admin)
            {
                return BadRequest("Role must be Researcher or Contributor");
            }

            var hashedPassword = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            var user = new User
            {
              FirstName = dto.FirstName,
              LastName = dto.LastName,
              Email = dto.Email,
              PasswordHash = hashedPassword,
              Role = parsedRole,
              CreatedAt = DateTime.UtcNow,
            };
            _context.Users.Add(user);
            _context.SaveChanges();

            CreateDefaultCollectionsForUser(user, parsedRole);
            _context.SaveChanges();

            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
        }

        private void CreateDefaultCollectionsForUser(User user, UserRole role)
        {
            if (role != UserRole.Contributor)
            {
                return;
            }

            _context.Collections.Add(
                new Collection
                {
                    Name = "Private Collection",
                    Description = "Private collection visible only to this contributor",
                    CreatedBy = user.Id,
                    OwnerId = user.Id,
                    OwnerType = OwnerType.User,
                    TemplateId = 0,
                    CreatedAt = DateTime.UtcNow
                }
            );
        }

        [HttpPut("{id}")]
        public IActionResult UpdateUser(int id, UpdateUserDto dto)
        {
            var user = _context.Users.Find(id);
            if (user == null)
                return NotFound();

            if (!string.IsNullOrEmpty(dto.FirstName))
                user.FirstName = dto.FirstName;
            if (!string.IsNullOrEmpty(dto.LastName))
                user.LastName = dto.LastName;
            if (!string.IsNullOrEmpty(dto.Email))
                user.Email = dto.Email;
            if (user.Role != dto.Role)
                user.Role = dto.Role;
            if (!string.IsNullOrEmpty(dto.Password))
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            user.UpdatedAt = DateTime.UtcNow;
            _context.SaveChanges();
            return Ok("User updated.");
        }


        [HttpDelete("{id}")]
        public IActionResult DeleteUser(int id)
        {
            var user = _context.Users.Find(id);
            if (user == null)
                return NotFound();

            if (!user.IsActive)
                return BadRequest("User is already deactivated.");

            user.IsActive = false;
            user.UpdatedAt = DateTime.UtcNow;
            _context.SaveChanges();

            return NoContent();
        }


        [HttpGet("{id}/documents")]
        public ActionResult GetUserDocuments(int id)
        {
            var user = _context.Users.Find(id);
            if (user == null)
                return NotFound();
            
            var documents = _context.UserDocuments.Where(d => d.UserId == id).Where(d => !d.IsDeleted).ToList();
            
            return Ok(documents.Select(d => new
            {
                d.Id,
                d.UserId,
                d.Path,
                d.Status,
                d.RejectionReason,
                d.UploadedAt,
                d.ReviewedAt,
                d.ReviewedBy,
                d.IsDeleted,
                d.DeletedAt
            }));
        }


        [HttpPost("{id}/documents")]
        public ActionResult CreateUserDocument(int id, [FromForm] CreateUserDocumentDto dto)
        {
            var user = _context.Users.Find(id);
            if (user == null)
                return NotFound();

            if (dto?.File == null || dto.File.Length == 0)
                return BadRequest(new { message = "A valid file is required" });

            var uploadPath = Path.Combine(
                Directory.GetCurrentDirectory(),
                "Uploads",
                $"user-{id}",
                "folder-Documents"
            );

            Directory.CreateDirectory(uploadPath);

            try
            {
                var fileName = $"{Guid.NewGuid()}_{dto.File.FileName}";
                var filePath = Path.Combine(uploadPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    dto.File.CopyTo(stream);
                }

                var userDocument = new UserDocument
                {
                    UserId = id,
                    Path = filePath,
                    Status = DocumentStatus.Pending,
                    UploadedAt = DateTime.UtcNow
                };

                _context.UserDocuments.Add(userDocument);
                _context.SaveChanges();

                return Ok(new { message = "Document uploaded successfully", documentId = userDocument.Id });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error uploading document", error = ex.Message });
            }
        }

        [HttpDelete("{userId}/documents/{documentId}")]
        public IActionResult DeleteUserDocument(int userId, int documentId)
        {
            var user = _context.Users.Find(userId);
            if (user == null)
                return NotFound(new { message = "User not found" });

            var document = _context.UserDocuments.Find(documentId);
            if (document == null || document.UserId != userId)
                return NotFound(new { message = "Document not found for this user" });

            if (document.IsDeleted)
                return BadRequest(new { message = "Document is already deleted" });

            document.IsDeleted = true;
            document.DeletedAt = DateTime.UtcNow;
            _context.SaveChanges();

            return Ok(new { message = "Document deleted successfully" });
        }

        [HttpPost("{userId}/documents/{documentId}/restore")]
        public IActionResult RestoreUserDocument(int userId, int documentId)
        {
            var user = _context.Users.Find(userId);
            if (user == null)
                return NotFound(new { message = "User not found" });

            var document = _context.UserDocuments.Find(documentId);
            if (document == null || document.UserId != userId)
                return NotFound(new { message = "Document not found for this user" });

            if (!document.IsDeleted)
                return BadRequest(new { message = "Document is not deleted" });

            document.IsDeleted = false;
            document.DeletedAt = default;
            _context.SaveChanges();

            return Ok(new { message = "Document restored successfully" });
        }


        [HttpPut("{userId}/documents/{documentId}/review")]
        public IActionResult ReviewUserDocument(int userId, int adminId, int documentId, DTO.ReviewDocumentDto dto)
        {
            var admin = _context.Users.Find(adminId);
            if (admin == null || admin.Role != UserRole.Admin)
                return Unauthorized(new { message = "Only admins can review documents" });

            var user = _context.Users.Find(userId);
            if (user == null)
                return NotFound(new { message = "User not found" });

            var document = _context.UserDocuments.Find(documentId);
            if (document == null || document.UserId != userId)
                return NotFound(new { message = "Document not found for this user" });

            if (document.IsDeleted)
                return BadRequest(new { message = "Cannot review a deleted document" });

            document.Status = dto.Status;
            document.Type = document.Type;
            document.ReviewedAt = DateTime.UtcNow;
            document.ReviewedBy = adminId;
            document.RejectionReason = dto.Status == DocumentStatus.Rejected ? dto.RejectionReason : null;

            _context.SaveChanges();

            return Ok(new { message = "Document reviewed successfully" });
        }

        



    }

}