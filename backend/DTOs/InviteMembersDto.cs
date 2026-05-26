using SarabPlatform.Enum;

namespace SarabPlatform.Dto
{
    public class InviteMemberDto
    {
        public string Email { get; set; } = string.Empty;
        public GroupRole Role { get; set; } = GroupRole.Researcher;
    }

    public class InviteMembersDto
    {
        public List<InviteMemberDto> Members { get; set; } = new List<InviteMemberDto>();
    }
}
