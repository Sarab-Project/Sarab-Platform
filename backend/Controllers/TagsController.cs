using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SarabPlatform.Models;
using SarabPlatform.Data;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TagsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TagsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult GetAllTags()
        {
            var tags = _context.Tags;
            return Ok(tags);
        }

        [HttpPut("{id}")]
        public IActionResult EditTag(int id, string newName)
        {
            var tag = _context.Tags.FirstOrDefault(t => t.Id == id);
            if (tag == null)
            {
                return NotFound("Tag not found.");
            }

            if (string.IsNullOrWhiteSpace(newName))
            {
                return BadRequest("New tag name cannot be empty.");
            }

            var existingTag = _context.Tags.FirstOrDefault(t => t.Name == newName);
            if (existingTag != null)
            {
                return Conflict("A tag with this name already exists.");
            }

            tag.Name = newName;
            _context.SaveChanges();

            return Ok(tag);
        }

        [HttpPost]
        public IActionResult CreateTag(string tagName)
        {
            if (string.IsNullOrWhiteSpace(tagName))
            {
                return BadRequest("Tag name cannot be empty.");
            }

            var existingTag = _context.Tags.FirstOrDefault(t => t.Name == tagName);
            if (existingTag != null)
            {
                return Conflict("A tag with this name already exists.");
            }

            var newTag = new Models.Tag { Name = tagName };
            _context.Tags.Add(newTag);
            _context.SaveChanges();

            return CreatedAtAction(nameof(GetAllTags), new { id = newTag.Id }, newTag);
        }


        [HttpDelete("{id}")]
        public IActionResult DeleteTag(int id)
        {
            var tag = _context.Tags.FirstOrDefault(t => t.Id == id);
            if (tag == null)
            {
                return NotFound("Tag not found.");
            }

            _context.Tags.Remove(tag);
            _context.SaveChanges();

            return Ok(tag);
        }

    }
}