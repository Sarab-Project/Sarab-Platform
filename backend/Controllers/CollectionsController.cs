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
    public class CollectionsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public CollectionsController(AppDbContext context)
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
        public IActionResult GetCollections()
        {
            var currentUserId = GetCurrentUserId();
            IQueryable<Collection> collectionsQuery = _context.Collections
                .Where(c => !c.IsDeleted)
                .Include(c => c.Folders!.Where(f => !f.IsDeleted))
                .Include(c => c.VisibleToGroups)!.ThenInclude(v => v.Group!);

            if (!IsAdminUser())
            {
                collectionsQuery = collectionsQuery.Where(c =>
                        (c.OwnerType == OwnerType.User && c.Name != "Private Collection") ||
                        (c.OwnerType == OwnerType.User && c.OwnerId == currentUserId) ||
                        (c.OwnerType == OwnerType.Group && _context.GroupMembers.Any(gm => gm.GroupId == c.OwnerId && gm.UserId == currentUserId)) ||
                        c.VisibleToGroups.Any(v => v.Group!.Members.Any(m => m.UserId == currentUserId))
                );
            }

            var collections = collectionsQuery.ToList();
            return Ok(collections);
        }
        
        [HttpGet("{id}")]
        public IActionResult GetCollection(int id)
        {
            var currentUserId = GetCurrentUserId();
            var collection = _context.Collections
                .Include(c => c.Folders!.Where(f => !f.IsDeleted))
                .Include(c => c.VisibleToGroups)!.ThenInclude(v => v.Group!)
                .FirstOrDefault(c => c.Id == id && !c.IsDeleted);
            if (collection == null)
            {
                return NotFound();
            }

            if (!IsAdminUser() && IsPrivateCollection(collection) && !(collection.OwnerType == OwnerType.User && collection.OwnerId == currentUserId))
            {
                return NotFound();
            }

            // Allow access if collection was explicitly made visible to a group the user is a member of
            if (!IsAdminUser() && collection.VisibleToGroups != null && collection.VisibleToGroups.Any())
            {
                var canSee = collection.VisibleToGroups.Any(v => v.Group != null && v.Group.Members.Any(m => m.UserId == currentUserId));
                if (!canSee && !(collection.OwnerType == OwnerType.Group && UserIsGroupMember(currentUserId, collection.OwnerId)))
                {
                    return NotFound();
                }
            }

            if (!IsAdminUser() && collection.OwnerType == OwnerType.Group && !UserIsGroupMember(currentUserId, collection.OwnerId))
            {
                return NotFound();
            }

            return Ok(collection);
        }

        [HttpPost]
        [Authorize(Policy = "ContributorOrAdmin")]
        public IActionResult CreateCollection([FromBody] CreateCollectionDto dto)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == 0)
            {
                return Unauthorized();
            }

            // Check if User exists
            var user = _context.Users.FirstOrDefault(u => u.Id == currentUserId);
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

                if (!UserIsGroupMember(currentUserId, group.Id) && !IsAdminUser())
                {
                    return Forbid("Only group members can create collections for this group.");
                }
            }
            else
            {
                var owner = _context.Users.FirstOrDefault(u => u.Id == dto.OwnerId);
                if (owner == null)
                {
                    return BadRequest("Owner not found.");
                }

                if (!IsAdminUser() && dto.OwnerId != currentUserId)
                {
                    return Forbid("Only the authenticated user can create a collection for their own account.");
                }
            }

            // Check if Template exists when provided
            if (dto.TemplateId > 0)
            {
                var template = _context.CollectionTemplates.FirstOrDefault(t => t.Id == dto.TemplateId);
                if (template == null)
                {
                    return BadRequest("Template not found.");
                }
            }

            var collection = new Collection
            {
                Name = dto.Name,
                Description = dto.Description,
                CreatedBy = currentUserId,
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

                // Handle allowed groups
                if (dto.AllowedGroupIds != null && dto.AllowedGroupIds.Count > 0)
                {
                    foreach (var gid in dto.AllowedGroupIds.Distinct())
                    {
                        var g = _context.Groups.FirstOrDefault(x => x.Id == gid && !x.IsDeleted);
                        if (g == null)
                        {
                            return BadRequest($"Group with id {gid} not found.");
                        }

                        if (!IsAdminUser() && !UserIsGroupMember(currentUserId, gid))
                        {
                            return Forbid("You can only assign visibility to groups you are a member of.");
                        }

                        _context.CollectionGroups.Add(new CollectionGroup
                        {
                            CollectionId = collection.Id,
                            GroupId = gid
                        });
                    }
                    _context.SaveChanges();
                }

                var result = _context.Collections
                    .Include(c => c.Folders!.Where(f => !f.IsDeleted))
                    .Include(c => c.VisibleToGroups)!.ThenInclude(v => v.Group!)
                    .FirstOrDefault(c => c.Id == collection.Id && !c.IsDeleted);

                return CreatedAtAction(nameof(GetCollection), new { id = collection.Id }, result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Policy = "AdminOnly")]
        public IActionResult DeleteCollection(int id)
        {
            var collection = _context.Collections.FirstOrDefault(c => c.Id == id && !c.IsDeleted);
            if (collection == null)
            {
                return NotFound();
            }

            var folders = _context.Folders.Where(f => f.CollectionId == id && !f.IsDeleted).ToList();
            foreach (var folder in folders)
            {
                SoftDeleteFolderAndDescendants(folder);
            }

            collection.IsDeleted = true;
            collection.DeletedAt = DateTime.UtcNow;
            _context.SaveChanges();
            return NoContent();
        }

    }
}