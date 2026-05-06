using System.ComponentModel.DataAnnotations;
using SarabPlatform.Enum;

namespace SarabPlatform.Models
{
    public class UserDocument
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public User? User { get; set; }
        public DocumentType Type { get; set; }
        [Required]
        public string? Path { get; set; }
        public DocumentStatus Status { get; set; } = DocumentStatus.Pending;
        public string? RejectionReason { get; set; }
        public DateTime UploadedAt { get; set; }
        public DateTime ReviewedAt { get; set; }
        public int ReviewedBy { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime DeletedAt { get; set; }

    }
}