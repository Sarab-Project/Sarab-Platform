using System.Collections.Generic;

namespace SarabPlatform.Dto
{
    public class SearchSampleDto
    {
        public string? Keyword { get; set; }
        public string? Gender { get; set; }
        public string? City { get; set; }
        public string? Status { get; set; }
        public int? MinAge { get; set; }
        public int? MaxAge { get; set; }
        public List<int>? TagIds { get; set; }
        public int? Page { get; set; }
        public int? PageSize { get; set; }
    }
}
