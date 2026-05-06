using System.ComponentModel.DataAnnotations;
using System.Runtime.CompilerServices;
using Microsoft.Identity.Client;
using SarabPlatform.Enum;

namespace SarabPlatform.Models
{
    public class Collection
    {
        public int Id { get; set; }
        [Required]
        [MinLength(3)]
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int CreatedBy { get; set; }
        public User? CreatedByUser { get; set; }
        public int? GroupId { get; set; }
        public Group? Group { get; set; }
        public int OwnerId { get; set; }
        public OwnerType OwnerType { get; set; }
        public int TemplateId { get; set; }
        public List<Folder>? Folders { get; set; }
        public int DownloadCount { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; }
        public DateTime DeletedAt { get; set; }

    }
}