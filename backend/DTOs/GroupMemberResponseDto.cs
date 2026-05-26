using SarabPlatform.Enum;

namespace SarabPlatform.Dto
{
    public class GroupMemberResponseDto
    {
        public UserPublicDto? User { get; set; }
        public GroupRole Role { get; set; }
        public DateTime JoinedAt { get; set; }
    }
}
