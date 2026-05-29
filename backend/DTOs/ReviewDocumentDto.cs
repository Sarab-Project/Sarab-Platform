using SarabPlatform.Enum;


namespace SarabPlatform.DTO
{
    public class ReviewDocumentDto
    {
        public DocumentType Type { get; set; }
        public DocumentStatus Status { get; set; }
        public string? RejectionReason { get; set; }
    }
}