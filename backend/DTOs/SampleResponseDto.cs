namespace SarabPlatform.Dto
{
    /// <summary>
    /// Response DTO for Sample with related data
    /// </summary>
    public class SampleResponseDto
    {
        public int Id { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        public int CreatedBy { get; set; }
        public int DownloadCount { get; set; }
        public string? Gender { get; set; }
        public int Age { get; set; }
        public string? City { get; set; }
        public string? Status { get; set; }
        public string? Notes { get; set; }
        public List<ResourceFileDto> Files { get; set; } = new();
        public List<TagDto> Tags { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }

    public class ResourceFileDto
    {
        public int Id { get; set; }
        public string? FileName { get; set; }
        public string? FileType { get; set; }
        public int Size { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class TagDto
    {
        public int Id { get; set; }
        public string? Name { get; set; }
    }
}
