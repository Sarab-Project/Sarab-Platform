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
    public class GroupsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public GroupsController(AppDbContext context)
        {
            _context = context;
        }

        private int? GetCurrentUserId()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return null;
            }
            return userId;
        }

        private bool IsAdminUser()
        {
            return User.IsInRole("Admin");
        }

        private bool UserIsGroupMember(int userId, int groupId)
        {
            return _context.GroupMembers.Any(gm => gm.GroupId == groupId && gm.UserId == userId);
        }

        private bool UserIsGroupOwner(int userId, int groupId)
        {
            return _context.GroupMembers.Any(gm => gm.GroupId == groupId && gm.UserId == userId && gm.Role == GroupRole.Owner);
        }

        private GroupResponseDto? BuildGroupResponse(IQueryable<Group> query)
        {
            return query.Select(g => new GroupResponseDto
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
            }).FirstOrDefault();
        }

        [HttpGet]
        public IActionResult GetGroups()
        {
            var currentUserId = GetCurrentUserId();
            var isAdmin = IsAdminUser();

            if (!isAdmin && !currentUserId.HasValue)
            {
                return Ok(new List<GroupResponseDto>());
            }

            var groups = _context.Groups
                .Where(g => !g.IsDeleted)
                .Where(g => isAdmin || g.Members.Any(m => m.UserId == currentUserId.Value))
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
            var currentUserId = GetCurrentUserId();
            var isAdmin = IsAdminUser();

            if (!isAdmin && (!currentUserId.HasValue || !UserIsGroupMember(currentUserId.Value, id)))
            {
                return NotFound();
            }

            var group = BuildGroupResponse(_context.Groups.Where(g => g.Id == id && !g.IsDeleted));
            if (group == null)
            {
                return NotFound();
            }
            return Ok(group);
        }

        [HttpPost]
        [Authorize]
        public IActionResult CreateGroup(CreateGroupDto dto)
        {
            var creatorIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (!int.TryParse(creatorIdClaim, out var creatorId))
            {
                return Unauthorized("Invalid authenticated user.");
            }

            var creator = _context.Users.FirstOrDefault(u => u.Id == creatorId);
            if (creator == null)
            {
                return BadRequest("Creator user not found.");
            }

            var group = new Group
            {
                Name = dto.Name,
                Description = dto.Description,
                CreatedBy = creatorId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Groups.Add(group);
            _context.SaveChanges();

            _context.GroupMembers.Add(new GroupMember
            {
                GroupId = group.Id,
                UserId = creatorId,
                Role = GroupRole.Owner,
                JoinedAt = DateTime.UtcNow
            });
            _context.SaveChanges();

            var collection = new Collection
            {
                Name = group.Name,
                Description = group.Description,
                CreatedBy = creatorId,
                Group = group,
                GroupId = group.Id,
                OwnerType = OwnerType.Group,
                OwnerId = group.Id,
                TemplateId = 0,
                IsDeleted = false,
                CreatedAt = DateTime.UtcNow
            };
            _context.Collections.Add(collection);
            _context.SaveChanges();

            return CreatedAtAction(nameof(GetGroup), new { id = group.Id }, group);
        }
                
        [HttpDelete("{id}")]
        [Authorize]
        public IActionResult DeleteGroup(int id)
        {
            var group = _context.Groups.FirstOrDefault(g => g.Id == id && !g.IsDeleted);
            if (group == null)
            {
                return NotFound("Group not found.");
            }

            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return Unauthorized("Authentication required.");
            }

            if (!IsAdminUser() && !UserIsGroupOwner(currentUserId.Value, id))
            {
                return Forbid();
            }

            group.IsDeleted = true;
            group.DeletedAt = DateTime.UtcNow;
            _context.SaveChanges();
            return Ok("Group deleted successfully.");
        }

        [HttpPost("{groupId}/members")]
        [Authorize(Policy = "AdminOnly")]
        public IActionResult AddMember(int groupId, [FromBody] AddMembersDto dto)
        {
            var group = _context.Groups.FirstOrDefault(g => g.Id == groupId && !g.IsDeleted);
            if (group == null)
            {
                return NotFound("Group not found.");
            }

            foreach (var member in dto.Members)
            {
                var user = _context.Users.FirstOrDefault(u => u.Id == member.UserId);
                if (user == null)
                {
                    return BadRequest($"User with ID {member.UserId} not found.");
                }

                if (user.Role == UserRole.Admin)
                {
                    return BadRequest($"Cannot add admin users to groups.");
                }

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

        [HttpPost("{groupId}/invite")]
        public IActionResult InviteMembers(int groupId, [FromBody] InviteMembersDto dto)
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return Unauthorized("Authentication required.");
            }

            var group = _context.Groups.FirstOrDefault(g => g.Id == groupId && !g.IsDeleted);
            if (group == null)
            {
                return NotFound("Group not found.");
            }

            if (!IsAdminUser() && !UserIsGroupOwner(currentUserId.Value, groupId))
            {
                return Forbid();
            }

            if (dto.Members == null || dto.Members.Count == 0)
            {
                return BadRequest("No members provided.");
            }

            foreach (var member in dto.Members)
            {
                if (string.IsNullOrWhiteSpace(member.Email))
                {
                    return BadRequest("Member email cannot be empty.");
                }

                var normalizedEmail = member.Email.Trim().ToLowerInvariant();
                var user = _context.Users.FirstOrDefault(u => u.Email!.ToLower() == normalizedEmail);
                if (user == null)
                {
                    return BadRequest($"User with email '{member.Email}' not found.");
                }

                if (user.Role == UserRole.Admin)
                {
                    return BadRequest($"Cannot add admin users to groups.");
                }

                if (currentUserId.Value == user.Id)
                {
                    return BadRequest("You cannot invite yourself to the group.");
                }

                if (_context.GroupMembers.Any(gm => gm.GroupId == groupId && gm.UserId == user.Id))
                {
                    return BadRequest($"User '{member.Email}' is already a member of this group.");
                }

                _context.GroupMembers.Add(new GroupMember
                {
                    UserId = user.Id,
                    GroupId = groupId,
                    Role = member.Role,
                    JoinedAt = DateTime.UtcNow
                });
            }

            _context.SaveChanges();

            var updatedGroup = BuildGroupResponse(_context.Groups.Where(g => g.Id == groupId && !g.IsDeleted));
            return Ok(updatedGroup);
        }

        [HttpPut("{groupId}/members/{userId}")]
        [Authorize(Policy = "AdminOnly")]
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
        [Authorize]
        public IActionResult RemoveMember(int groupId, int userId)
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return Unauthorized("Authentication required.");
            }

            var membership = _context.GroupMembers.FirstOrDefault(gm => gm.GroupId == groupId && gm.UserId == userId);
            if (membership == null)
            {
                return NotFound("Membership not found.");
            }

            if (!IsAdminUser() && !UserIsGroupOwner(currentUserId.Value, groupId))
            {
                return Forbid();
            }

            _context.GroupMembers.Remove(membership);
            _context.SaveChanges();
            return Ok("Member removed successfully.");
        }

        [HttpPost("{groupId}/leave")]
        [Authorize]
        public IActionResult LeaveGroup(int groupId)
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return Unauthorized("Authentication required.");
            }

            var membership = _context.GroupMembers.FirstOrDefault(gm => gm.GroupId == groupId && gm.UserId == currentUserId.Value);
            if (membership == null)
            {
                return NotFound("Membership not found.");
            }

            if (membership.Role == GroupRole.Owner)
            {
                return BadRequest("Group owner cannot leave the group. Delete the group instead.");
            }

            _context.GroupMembers.Remove(membership);
            _context.SaveChanges();
            return Ok("Left group successfully.");
        }

    }
}