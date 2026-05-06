using System.ComponentModel.DataAnnotations;

namespace SarabPlatform.Dto
{
    /// <summary>
    /// DTO for searching samples with advanced filtering and pagination
    /// </summary>
    public class SearchSampleDto
    {
        // Filter parameters
        public string? Gender { get; set; }
        public string? City { get; set; }
        public string? Status { get; set; }

        [Range(0, 150, ErrorMessage = "MinAge must be between 0 and 150")]
        public int MinAge { get; set; }

        [Range(0, 150, ErrorMessage = "MaxAge must be between 0 and 150")]
        public int MaxAge { get; set; }

        [StringLength(100, ErrorMessage = "Keyword cannot exceed 100 characters")]
        public string? Keyword { get; set; }

        public List<int>? TagIds { get; set; }

        // Pagination parameters
        [Range(1, int.MaxValue, ErrorMessage = "Page must be at least 1")]
        public int Page { get; set; } = 1;

        [Range(1, 100, ErrorMessage = "PageSize must be between 1 and 100")]
        public int PageSize { get; set; } = 10;
    }
}