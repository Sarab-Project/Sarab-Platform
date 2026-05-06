using System.ComponentModel.DataAnnotations;

namespace SarabPlatform.Models
{
    public class Sample
    {
        public int Id { get; set; }
        [Required]
        public string? Title { get; set; }
        public int? FolderId { get; set; }
        public Folder? Folder { get; set; }
        public string? Description { get; set; }
        public int CreatedBy { get; set; }
        public int DownloadCount { get; set; }
        [Required]
        public string? Metadata { get; set; }
        public string? Gender { get; set; }
        public int Age { get; set; }
        public string City { get; set; }
        public string Status { get; set; }
        public string Notes { get; set; }
        public List<ResourceFile> Files { get; set; }
        public List<Tag> Tags { get; set; } = new();
        public bool IsDeleted { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdateAt { get; set; }
        public DateTime DeletedAt { get; set; }

    }
}