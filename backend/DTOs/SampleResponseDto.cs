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
        public UserPublicDto? CreatedByUser { get; set; }
        public int? FolderId { get; set; }
        public FolderDto? Folder { get; set; }
        public int DownloadCount { get; set; }
        public int ViewCount { get; set; }
        public string? Metadata { get; set; }
        public string? EyeSide { get; set; }
        public string? Gender { get; set; }
        public int? Age { get; set; }
        public string? City { get; set; }
        public string? Status { get; set; }
        public string? Profession { get; set; }
        public string? Notes { get; set; }
        public List<ResourceFileDto> Files { get; set; } = new();
        public List<TagDto> Tags { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }

    public class FolderDto
    {
        public int Id { get; set; }
        public string? Name { get; set; }
    }

    public class ResourceFileDto
    {
        public int Id { get; set; }
        public string? FileName { get; set; }
        public int FileType { get; set; }
        public string? FilePath { get; set; }
        public int Size { get; set; }
        public string? Metadata { get; set; }
        public string? EyeSide { get; set; }
        public string? Gender { get; set; }
        public int? Age { get; set; }
        public string? City { get; set; }
        public string? Status { get; set; }
        public string? Profession { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UploadedAt { get; set; }
    }

    public class TagDto
    {
        public int Id { get; set; }
        public string? Name { get; set; }
    }
}
