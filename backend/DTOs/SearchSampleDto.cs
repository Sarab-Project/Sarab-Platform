using System.Collections.Generic;

namespace SarabPlatform.Dto
{
    public class SearchSampleDto
    {
        public string? Keyword { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? EyeSide { get; set; }
        public string? Gender { get; set; }
        public int? MinAge { get; set; }
        public int? MaxAge { get; set; }
        public string? City { get; set; }
        public string? Condition { get; set; }
        public string? Profession { get; set; }
        public string? Notes { get; set; }
        public string? Status { get; set; }
        public List<int>? TagIds { get; set; }
        public List<string>? FileTypes { get; set; }
        public string? ContributorName { get; set; }
        public string? MetadataKey { get; set; }
        public string? MetadataValue { get; set; }
        public int? Page { get; set; }
        public int? PageSize { get; set; }
    }
}
