using Microsoft.AspNetCore.Http;

namespace SarabPlatform.Dto
{
    public class CreateSampleDto
    {
        public int FolderId { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? FileMetadataJson { get; set; }
        public List<int>? Tags { get; set; }
        public List<IFormFile> Files { get; set; }
    }
}