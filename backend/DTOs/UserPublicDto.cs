using SarabPlatform.Enum;

namespace SarabPlatform.Dto
{
    public class UserPublicDto
    {
        public int Id { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public string? ProfileImagePath { get; set; }
    }
}
