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
            return string.Equals(collection.Name, "Private", StringComparison.OrdinalIgnoreCase);
        }

        [HttpGet]
        [AllowAnonymous]
        public IActionResult GetCollections()
        {
            var currentUserId = GetCurrentUserId();
            IQueryable<Collection> collectionsQuery = _context.Collections
                .Where(c => !c.IsDeleted)
                .Include(c => c.Folders!.Where(f => !f.IsDeleted));

            if (!IsAdminUser())
            {
                collectionsQuery = collectionsQuery.Where(c => c.Name != "Private" || (c.OwnerType == OwnerType.User && c.OwnerId == currentUserId));
            }

            var collections = collectionsQuery.ToList();
            return Ok(collections);
        }
        
        [HttpGet("{id}")]
        [AllowAnonymous]
        public IActionResult GetCollection(int id)
        {
            var currentUserId = GetCurrentUserId();
            var collection = _context.Collections
                .Include(c => c.Folders!.Where(f => !f.IsDeleted))
                .FirstOrDefault(c => c.Id == id && !c.IsDeleted);
            if (collection == null)
            {
                return NotFound();
            }

            if (!IsAdminUser() && IsPrivateCollection(collection) && !(collection.OwnerType == OwnerType.User && collection.OwnerId == currentUserId))
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
            }
            else
            {
                var owner = _context.Users.FirstOrDefault(u => u.Id == dto.OwnerId);
                if (owner == null)
                {
                    return BadRequest("Owner not found.");
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
                return CreatedAtAction(nameof(GetCollection), new { id = collection.Id }, collection);
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
            collection.IsDeleted = true;
            collection.DeletedAt = DateTime.UtcNow;
            _context.SaveChanges();
            return NoContent();
        }

    }
}