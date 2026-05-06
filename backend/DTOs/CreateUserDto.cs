using System.ComponentModel.DataAnnotations;

namespace SarabPlatform.Dto
{
    public class CreateUserDto
    {
        [Required]
        [MinLength(3)]
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        [Required]
        [EmailAddress]
        public string? Email { get; set; }
        [Required]
        [MinLength(8)]
        public string? Password { get; set; }

    }







}