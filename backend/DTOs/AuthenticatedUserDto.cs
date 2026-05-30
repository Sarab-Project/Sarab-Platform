using SarabPlatform.Enum;

namespace SarabPlatform.Dto
{
    public class AuthenticatedUserDto
    {
        public int Id { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public UserRole Role { get; set; }
    }
}
