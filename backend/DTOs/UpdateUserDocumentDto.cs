using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace SarabPlatform.Dto
{
    public class UpdateUserDocumentDto
    {
        [Required]
        public IFormFile File { get; set; }
    }
}
