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