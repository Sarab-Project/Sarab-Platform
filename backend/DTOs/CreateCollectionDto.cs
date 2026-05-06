using SarabPlatform.Enum;
namespace SarabPlatform.Dto
{
    public class CreateCollectionDto
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int CreatedBy { get; set; }
        public int OwnerId { get; set; }
        public OwnerType OwnerType { get; set; }
        public int TemplateId { get; set; }
    }
    
}