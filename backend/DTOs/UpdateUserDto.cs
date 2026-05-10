using SarabPlatform.Enum;

namespace SarabPlatform.Dto
{
    public class UpdateUserDto
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public UserRole Role { get; set; }
        public string? Password { get; set; }
    }
}