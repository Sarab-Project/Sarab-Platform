namespace SarabPlatform.Dto
{
    /// <summary>
    /// Generic paginated response for list endpoints
    /// </summary>
    public class PaginatedResponseDto<T>
    {
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
        public bool HasNextPage { get; set; }
        public bool HasPreviousPage { get; set; }
        public List<T> Data { get; set; } = new();
    }
}
