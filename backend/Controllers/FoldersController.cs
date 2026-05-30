using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SarabPlatform.Data;
using SarabPlatform.Dto;
using SarabPlatform.Enum;
using SarabPlatform.Models;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FoldersController : ControllerBase
    {
        private readonly AppDbContext _context;
        public FoldersController(AppDbContext context)
        {
            _context = context;
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

        private void SoftDeleteSamplesInFolder(int folderId)
        {
            var samples = _context.Samples
                .Include(s => s.Files)
                .Where(s => s.FolderId == folderId && !s.IsDeleted)
                .ToList();

            foreach (var sample in samples)
            {
                sample.IsDeleted = true;
                sample.DeletedAt = DateTime.UtcNow;

                foreach (var file in sample.Files ?? new List<ResourceFile>())
                {
                    file.IsDeleted = true;
                    file.DeletedAt = DateTime.UtcNow;
                }
            }
        }

        private void SoftDeleteFolderAndDescendants(Folder folder)
        {
            folder.IsDeleted = true;
            folder.DeletedAt = DateTime.UtcNow;

            SoftDeleteSamplesInFolder(folder.Id);

            var childFolders = _context.Folders
                .Where(f => f.ParentId == folder.Id && !f.IsDeleted)
                .ToList();

            foreach (var child in childFolders)
            {
                SoftDeleteFolderAndDescendants(child);
            }
        }

        [HttpGet]
        [AllowAnonymous]
        public IActionResult GetFolders()
        {
            var currentUserId = GetCurrentUserId();
            IQueryable<Folder> query = _context.Folders
                .Where(f => !f.IsDeleted && !f.Collection!.IsDeleted)
                .Include(f => f.Samples!.Where(sa => !sa.IsDeleted))
                .Include(f => f.Children!.Where(c => !c.IsDeleted))
                .Include(f => f.Collection);

            if (!IsAdminUser())
            {
                query = query.Where(f =>
                    (f.Collection!.OwnerType == OwnerType.User && f.Collection.Name != "Private Collection") ||
                    (f.Collection!.OwnerType == OwnerType.User && f.Collection.OwnerId == currentUserId) ||
                    (f.Collection!.OwnerType == OwnerType.Group && _context.GroupMembers.Any(gm => gm.GroupId == f.Collection.OwnerId && gm.UserId == currentUserId))
                );
            }

            var folders = query.ToList();
            return Ok(folders);
        }
        
        [HttpGet("{id}")]
        [AllowAnonymous]
        public IActionResult GetFolder(int id)
        {
            var currentUserId = GetCurrentUserId();
            var folder = _context.Folders
                .Include(f => f.Samples!.Where(sa => !sa.IsDeleted))
                .Include(f => f.Children!.Where(c => !c.IsDeleted))
                .Include(f => f.Collection)
                .FirstOrDefault(f => f.Id == id && !f.IsDeleted && !f.Collection!.IsDeleted);
            if (folder == null)
            {
                return NotFound();
            }

            if (!IsAdminUser() && IsPrivateCollection(folder.Collection!) && !(folder.Collection!.OwnerType == OwnerType.User && folder.Collection!.OwnerId == currentUserId))
            {
                return NotFound();
            }

            if (!IsAdminUser() && folder.Collection!.OwnerType == OwnerType.Group && !UserIsGroupMember(currentUserId, folder.Collection.OwnerId))
            {
                return NotFound();
            }

            return Ok(folder);
        }

        [HttpPost]
        [Authorize(Policy = "ContributorOrAdmin")]
        public IActionResult CreateFolder([FromBody] CreateFolderDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var currentUserId = GetCurrentUserId();
            if (currentUserId == 0)
            {
                return Unauthorized();
            }

            // Check if Collection exists
            var collection = _context.Collections.FirstOrDefault(c => c.Id == dto.CollectionId);
            if (collection == null)
            {
                return BadRequest("Collection not found.");
            }

            if (!IsAdminUser())
            {
                if (collection.OwnerType == OwnerType.User && collection.OwnerId != currentUserId)
                {
                    return Forbid("You cannot add folders to another user's collection.");
                }

                if (collection.OwnerType == OwnerType.Group && !UserIsGroupContributor(currentUserId, collection.OwnerId))
                {
                    return Forbid("Only group contributors can add folders to this group collection.");
                }
            }

            var user = _context.Users.FirstOrDefault(u => u.Id == currentUserId);
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
                CreatedBy = currentUserId,
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

        [HttpDelete("{id}")]
        [Authorize(Policy = "ContributorOrAdmin")]
        public async Task<IActionResult> DeleteFolder(int id)
        {
            var folder = _context.Folders.FirstOrDefault(f => f.Id == id && !f.IsDeleted);
            if (folder == null)
            {
                return NotFound();
            }

            SoftDeleteFolderAndDescendants(folder);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}