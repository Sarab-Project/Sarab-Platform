namespace SarabPlatform.Dto
{
    public class GroupResponseDto
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<GroupMemberResponseDto>? Members { get; set; }
    }
}
