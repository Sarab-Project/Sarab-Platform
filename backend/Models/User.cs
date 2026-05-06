using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using SarabPlatform.Enum;
namespace SarabPlatform.Models
{
    public class User
    {
        public int Id { get; set; }
        [Required]
        [MinLength(3)]
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        [Required]
        public UserRole Role { get; set; }
        [Required]
        [EmailAddress]
        public string? Email { get; set; }
        [Required]
        [JsonIgnore]
        public string? PasswordHash { get; set; }
        public string? ProfileImagePath { get; set; }
        public UserDocument? Document { get; set; }
        public List<UserSession>? UserSessions { get; set; }
        public List<GroupMember>? Groups { get; set; }
        public List<Collection>? Collections { get; set; }
        public List<Folder>? Folders { get; set; }
        public List<Sample>? Samples { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; }
        public bool IsActive { get; set; } = true;
        public bool IsVerified { get; set; } = false;
        public bool IsEmailVerified { get; set; } = false;
        DateTime EmailVerifiedAt { get; set; }
        DateTime LastLoginAt { get; set; }
        DateTime LastPasswordChangeAt { get; set; }
        int FailedLoginAttempts { get; set; } = 5;
        DateTime LockedUntil { get; set; }
        DateTime DeActivatedAt { get; set;}
    } 

    
}