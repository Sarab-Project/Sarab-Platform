using System.ComponentModel.DataAnnotations;
using SarabPlatform.Enum;

namespace SarabPlatform.Models
{
    public class ResourceFile
    {
        public int Id { get; set; }
        [Required]
        [MinLength(3)]
        public string FileName { get; set; }
        [Required]
        public FileType FileType { get; set; }
        [Required]
        public string? FilePath { get; set; }
        public int Size { get; set; }
        public int SampleId { get; set; }
        public bool IsDeleted { get; set; }
        public int UploadedBy { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UploadedAt { get; set; }
        public DateTime DeletedAt { get; set; }
        
    }
}