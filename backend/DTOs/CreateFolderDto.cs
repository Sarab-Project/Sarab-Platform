using System.ComponentModel.DataAnnotations;

namespace SarabPlatform.Dto
{
    public class CreateFolderDto
    {
        [Required]
        [MinLength(3)]
        public string? Name { get; set; }
        public int? ParentId { get; set; }
        public int CollectionId { get; set; }
        public int CreatedBy { get; set; }
    }
}