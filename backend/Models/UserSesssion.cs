using System.ComponentModel.DataAnnotations;

namespace SarabPlatform.Models
{
    public class UserSession
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string? RefreshToken { get; set; }
        public string? IpAddress { get; set; }
        public string? DeviceInfo { get; set; }
        public bool IsRevoked { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public DateTime LastLogin { get; set; }
    }
}