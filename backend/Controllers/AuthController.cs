using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SarabPlatform.Data;
using SarabPlatform.Dto;
using SarabPlatform.Enum;
using SarabPlatform.Models;
using SarabPlatform.Services;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly TokenService _tokenService;

        public AuthController(AppDbContext context, TokenService tokenService)
        {
            _context = context;
            _tokenService = tokenService;
        }

        [HttpPost("signup")]
        [AllowAnonymous]
        public async Task<IActionResult> Signup(CreateUserDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (existingUser != null)
                return Conflict(new { message = "Email is already registered" });

            if (!System.Enum.TryParse<UserRole>(dto.Role, true, out var parsedRole) || parsedRole == UserRole.Admin)
            {
                return BadRequest(new { message = "Role must be Researcher or Contributor" });
            }

            var user = new User
            {
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                Email = dto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = parsedRole,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            CreateDefaultCollectionsForUser(user, parsedRole);
            await _context.SaveChangesAsync();

            var response = new AuthResponseDto
            {
                Token = _tokenService.GenerateToken(user),
                ExpiresAt = DateTime.UtcNow.AddMinutes(1440),
                User = new AuthenticatedUserDto
                {
                    Id = user.Id,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    Email = user.Email,
                    Role = user.Role
                }
            };

            return CreatedAtAction(null, response);
        }

        private void CreateDefaultCollectionsForUser(User user, UserRole role)
        {
            if (role != UserRole.Contributor)
            {
                return;
            }

            _context.Collections.Add(
                new Collection
                {
                    Name = "Private Collection",
                    Description = "Private collection visible only to this contributor",
                    CreatedBy = user.Id,
                    OwnerId = user.Id,
                    OwnerType = OwnerType.User,
                    TemplateId = 0,
                    CreatedAt = DateTime.UtcNow
                }
            );
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null)
                return Unauthorized(new { message = "Invalid email or password" });

            if (!user.IsActive)
                return Unauthorized(new { message = "Account is disabled" });

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                return Unauthorized(new { message = "Invalid email or password" });

            var token = _tokenService.GenerateToken(user);
            var tokenHandler = new JwtSecurityTokenHandler();
            var jwtToken = tokenHandler.ReadJwtToken(token);

            var refreshToken = Guid.NewGuid().ToString();
            var session = new UserSession
            {
                UserId = user.Id,
                RefreshToken = refreshToken,
                ExpiresAt = DateTime.UtcNow.AddDays(30),
                CreatedAt = DateTime.UtcNow,
                LastLogin = DateTime.UtcNow,
                IsRevoked = false
            };
            _context.UserSessions.Add(session);
            await _context.SaveChangesAsync();

            var response = new AuthResponseDto
            {
                Token = token,
                RefreshToken = refreshToken,
                ExpiresAt = jwtToken.ValidTo,
                User = new AuthenticatedUserDto
                {
                    Id = user.Id,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    Email = user.Email,
                    Role = user.Role
                }
            };

            return Ok(response);
        }

        [HttpPost("refresh")]
        [AllowAnonymous]
        public async Task<IActionResult> Refresh(RefreshTokenDto dto)
        {
            var session = await _context.UserSessions
                .FirstOrDefaultAsync(s => s.RefreshToken == dto.RefreshToken && !s.IsRevoked && s.ExpiresAt > DateTime.UtcNow);

            if (session == null)
                return Unauthorized(new { message = "Invalid or expired refresh token" });

            var user = await _context.Users.FindAsync(session.UserId);
            if (user == null || !user.IsActive)
                return Unauthorized(new { message = "User not found or inactive" });

            var newToken = _tokenService.GenerateToken(user);
            var tokenHandler = new JwtSecurityTokenHandler();
            var jwtToken = tokenHandler.ReadJwtToken(newToken);

            var newRefreshToken = Guid.NewGuid().ToString();
            session.RefreshToken = newRefreshToken;
            session.ExpiresAt = DateTime.UtcNow.AddDays(30);
            await _context.SaveChangesAsync();

            var response = new AuthResponseDto
            {
                Token = newToken,
                RefreshToken = newRefreshToken,
                ExpiresAt = jwtToken.ValidTo,
                User = new AuthenticatedUserDto
                {
                    Id = user.Id,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    Email = user.Email,
                    Role = user.Role
                }
            };

            return Ok(response);
        }

        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Logout(RefreshTokenDto dto)
        {
            var session = await _context.UserSessions
                .FirstOrDefaultAsync(s => s.RefreshToken == dto.RefreshToken);

            if (session != null)
            {
                session.IsRevoked = true;
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Logged out successfully" });
        }
    }
}
