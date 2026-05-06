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
            var users = _context.Users.ToList();
            return Ok(users);
        }

        [HttpGet("{id}")]
        public ActionResult<User> GetUser(int id)
        {
            try
            {
                var user = _context.Users.Find(id);
                if (user == null)
                    return NotFound();

                return Ok(user);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        [HttpPost]
        public ActionResult<User> CreateUser(CreateUserDto dto)
        {
            var hashedPassword = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            var user = new User
            {
              FirstName = dto.FirstName,
              LastName = dto.LastName,
              Email = dto.Email,
              PasswordHash = hashedPassword,
              Role = UserRole.Researcher,
              CreatedAt = DateTime.UtcNow,
            };
            _context.Users.Add(user);
            _context.SaveChanges();
            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
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

            _context.Users.Remove(user);
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
        public IActionResult ReviewUserDocument(int userId, int adminId, int documentId, ReviewDocumentDto dto)
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