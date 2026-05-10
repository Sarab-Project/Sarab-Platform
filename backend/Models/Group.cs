using System.ComponentModel.DataAnnotations;
using System.Runtime.CompilerServices;

namespace SarabPlatform.Models
{
    public class Group
    {
        public int Id { get; set; }
        [Required]
        [MinLength(3)]
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int CreatedBy { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime DeletedAt { get; set; }
        public List<GroupMember> Members { get; set; }
        public List<Collection>? Collections { get; set; }
    }
}