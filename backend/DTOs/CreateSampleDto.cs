namespace SarabPlatform.Dto
{
    public class CreateSampleDto
    {
        public int FolderId { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? EyeSide { get; set; }
        public string? Gender { get; set; }
        public int Age { get; set; }
        public string? City { get; set; }
        public string? Status { get; set; }
        public string? Profession { get; set; }
        public string? Notes { get; set; }
        public List<IFormFile> Files { get; set; } 

    }
}