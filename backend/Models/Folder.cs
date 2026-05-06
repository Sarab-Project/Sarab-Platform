using System.ComponentModel.DataAnnotations;

namespace SarabPlatform.Models
{
    public class Folder
    {
        public int Id { get; set; }
        [Required]
        [MinLength(3)]
        public string? Name { get; set; }
        public int? ParentId { get; set; }
        public Folder? Parent { get; set; }
        public List<Folder>? Children { get; set; }
        public int CollectionId { get; set; }
        public Collection? Collection { get; set; }
        public int CreatedBy { get; set; }
        public User? CreatedByUser { get; set; }
        public List<Sample>? Samples { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; }
        public DateTime DeletedAt { get; set; }
    }
}