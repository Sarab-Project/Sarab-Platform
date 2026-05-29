namespace SarabPlatform.Dto
{
    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public AuthenticatedUserDto? User { get; set; }
    }
}
