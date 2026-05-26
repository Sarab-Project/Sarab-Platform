using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SarabPlatform.Data;
using SarabPlatform.Dto;
using SarabPlatform.Models;


namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CollectionTemplatesController : ControllerBase
    {
        private readonly AppDbContext _context;
        public CollectionTemplatesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult GetCollectionTemplates()
        {
            var templates = _context.CollectionTemplates
                .Where(t => !t.IsDeleted)
                .ToList();
            return Ok(templates);
        }
        
        [HttpGet("{id}")]
        public IActionResult GetCollectionTemplate(int id)
        {
            var template = _context.CollectionTemplates
                .FirstOrDefault(t => t.Id == id && !t.IsDeleted);
            if (template == null)
            {
                return NotFound();
            }
            return Ok(template);
        }

        [HttpPost]
        public IActionResult CreateCollectionTemplate([FromBody] CreateCollectionTemplateDto dto)
        {
            // Check if User exists
            var user = _context.Users.FirstOrDefault(u => u.Id == dto.CreatedBy);
            if (user == null)
            {
                return BadRequest("User not found.");
            }

            var template = new CollectionTemplate
            {
                Name = dto.Name,
                Description = dto.Description,
                CreatedBy = dto.CreatedBy,
                CreatedAt = DateTime.UtcNow
            };
            
            _context.CollectionTemplates.Add(template);
            _context.SaveChanges();
            
            return CreatedAtAction(nameof(GetCollectionTemplate), new { id = template.Id }, template);
        }

        [HttpDelete("{id}")]
        public IActionResult DeleteCollectionTemplate(int id)
        {
            var template = _context.CollectionTemplates.FirstOrDefault(t => t.Id == id && !t.IsDeleted);
            if (template == null)
            {
                return NotFound();
            }
            template.IsDeleted = true;
            template.DeletedAt = DateTime.UtcNow;
            _context.SaveChanges();
            return NoContent();
        }
    }
}