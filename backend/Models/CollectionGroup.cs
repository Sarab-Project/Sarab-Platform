namespace SarabPlatform.Models
{
    public class CollectionGroup
    {
        public int CollectionId { get; set; }
        public Collection? Collection { get; set; }

        public int GroupId { get; set; }
        public Group? Group { get; set; }
    }
}
