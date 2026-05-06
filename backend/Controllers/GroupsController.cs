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
    public class GroupsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public GroupsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult GetGroups()
        {
            var groups = _context.Groups
                .Where(g => !g.IsDeleted)
                .Select(g => new GroupResponseDto
                {
                    Id = g.Id,
                    Name = g.Name,
                    Description = g.Description,
                    CreatedBy = g.CreatedBy,
                    CreatedAt = g.CreatedAt,
                    Members = g.Members.Select(m => new GroupMemberResponseDto
                    {
                        Role = m.Role,
                        JoinedAt = m.JoinedAt,
                        User = new UserPublicDto
                        {
                            Id = m.User!.Id,
                            FirstName = m.User.FirstName,
                            LastName = m.User.LastName,
                            Email = m.User.Email,
                            ProfileImagePath = m.User.ProfileImagePath,
                        }
                    }).ToList()
                })
                .ToList();
            return Ok(groups);
        }

        [HttpGet("{id}")]
        public IActionResult GetGroup(int id)
        {
            var group = _context.Groups
                .Where(g => g.Id == id && !g.IsDeleted)
                .Select(g => new GroupResponseDto
                {
                    Id = g.Id,
                    Name = g.Name,
                    Description = g.Description,
                    CreatedBy = g.CreatedBy,
                    CreatedAt = g.CreatedAt,
                    Members = g.Members.Select(m => new GroupMemberResponseDto
                    {
                        Role = m.Role,
                        JoinedAt = m.JoinedAt,
                        User = new UserPublicDto
                        {
                            Id = m.User!.Id,
                            FirstName = m.User.FirstName,
                            LastName = m.User.LastName,
                            Email = m.User.Email,
                            ProfileImagePath = m.User.ProfileImagePath,
                        }
                    }).ToList()
                })
                .FirstOrDefault();

            if (group == null)
            {
                return NotFound();
            }
            return Ok(group);
        }

        [HttpPost]
        public IActionResult CreateGroup(CreateGroupDto dto)
        {
            var group = new Group
            {
                Name = dto.Name,
                Description = dto.Description,
                CreatedBy = dto.CreatedBy,
                CreatedAt = DateTime.UtcNow
            };
            _context.Groups.Add(group);
            _context.SaveChanges();
            return CreatedAtAction(nameof(GetGroup), new { id = group.Id }, group);
        }
                
        [HttpDelete("{id}")]
        public IActionResult DeleteGroup(int id)
        {
            var group = _context.Groups.FirstOrDefault(g => g.Id == id && !g.IsDeleted);
            if (group == null)
            {
                return NotFound("Group not found.");
            }
            group.IsDeleted = true;
            group.DeletedAt = DateTime.UtcNow;
            _context.SaveChanges();
            return Ok("Group deleted successfully.");
        }

        [HttpPost("{groupId}/members")]
        public IActionResult AddMember(int groupId, [FromBody] AddMembersDto dto)
        {
            var group = _context.Groups.FirstOrDefault(g => g.Id == groupId && !g.IsDeleted);
            if (group == null)
            {
                return NotFound("Group not found.");
            }

            foreach (var member in dto.Members)
            {
                // Check if user exists
                var user = _context.Users.FirstOrDefault(u => u.Id == member.UserId);
                if (user == null)
                {
                    return BadRequest($"User with ID {member.UserId} not found.");
                }

                // Check if already a member
                if (_context.GroupMembers.Any(gm => gm.GroupId == groupId && gm.UserId == member.UserId))
                {
                    continue; 
                }

                _context.GroupMembers.Add(new GroupMember
                {
                    UserId = member.UserId,
                    GroupId = groupId,
                    Role = member.Role,
                    JoinedAt = DateTime.UtcNow
                });
            }
            _context.SaveChanges();

            var updatedGroup = _context.Groups
                .Where(g => g.Id == groupId && !g.IsDeleted)
                .Select(g => new GroupResponseDto
                {
                    Id = g.Id,
                    Name = g.Name,
                    Description = g.Description,
                    CreatedBy = g.CreatedBy,
                    CreatedAt = g.CreatedAt,
                    Members = g.Members.Select(m => new GroupMemberResponseDto
                    {
                        Role = m.Role,
                        JoinedAt = m.JoinedAt,
                        User = new UserPublicDto
                        {
                            Id = m.User!.Id,
                            FirstName = m.User.FirstName,
                            LastName = m.User.LastName,
                            Email = m.User.Email,
                            ProfileImagePath = m.User.ProfileImagePath,
                        }
                    }).ToList()
                })
                .FirstOrDefault();

            return Ok(updatedGroup);

        }

        [HttpPut("{groupId}/members/{userId}")]
        public IActionResult ChangeMemberRole(int groupId, int userId,[FromBody] ChangeMemberRoleDto dto)
        {
            var group = _context.Groups.FirstOrDefault(g => g.Id == groupId && !g.IsDeleted);
            if (group == null)
            {
                return NotFound("Group not found.");
            }
            var member = _context.GroupMembers.FirstOrDefault(gm => gm.GroupId == groupId && gm.UserId == userId);
            if (member == null)
            {
                return NotFound("Member not found.");
            }
            member.Role = dto.NewRole;
            _context.SaveChanges();
            return Ok("Member role updated successfully.");

        }

        [HttpDelete("{groupId}/members/{userId}")]
        public IActionResult RemoveMember(int groupId, int userId)
        {
            var membership = _context.GroupMembers.FirstOrDefault(gm => gm.GroupId == groupId && gm.UserId == userId);
            if (membership == null)
            {
                return NotFound("Membership not found.");
            }
            _context.GroupMembers.Remove(membership);
            _context.SaveChanges();
            return Ok("Member removed successfully.");
        }

    }
}