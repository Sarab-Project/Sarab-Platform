using SarabPlatform.Enum;

namespace SarabPlatform.Dto
{
    public class GroupMembersDto
    {
        public int UserId { get; set; }
        public GroupRole Role { get; set; } = GroupRole.Guest;
    }
}