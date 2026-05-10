using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SarabPlatform.Data;
using SarabPlatform.Dto;
using SarabPlatform.Models;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FoldersController : ControllerBase
    {
        private readonly AppDbContext _context;
        public FoldersController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult GetFolders()
        {
            var folders = _context.Folders
                .Where(f => !f.IsDeleted)
                .Include(f => f.Samples!.Where(sa => !sa.IsDeleted))
                .Include(f => f.Children!.Where(c => !c.IsDeleted))
                .ToList();
            return Ok(folders);
        }
        
        [HttpGet("{id}")]
        public IActionResult GetFolder(int id)
        {
            var folder = _context.Folders
                .Include(f => f.Samples!.Where(sa => !sa.IsDeleted))
                .Include(f => f.Children!.Where(c => !c.IsDeleted))
                .FirstOrDefault(f => f.Id == id && !f.IsDeleted);
            if (folder == null)
            {
                return NotFound();
            }
            return Ok(folder);
        }

        [HttpPost]
        public IActionResult CreateFolder([FromBody] CreateFolderDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Check if Collection exists
            var collection = _context.Collections.FirstOrDefault(c => c.Id == dto.CollectionId);
            if (collection == null)
            {
                return BadRequest("Collection not found.");
            }

            // Check if User exists
            var user = _context.Users.FirstOrDefault(u => u.Id == dto.CreatedBy);
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
                CreatedBy = dto.CreatedBy,
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
        public async Task<IActionResult> DeleteFolder(int id)
        {
            var folder = _context.Folders.FirstOrDefault(f => f.Id == id && !f.IsDeleted);
            if (folder == null)
            {
                return NotFound();
            }

            folder.IsDeleted = true;
            folder.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}