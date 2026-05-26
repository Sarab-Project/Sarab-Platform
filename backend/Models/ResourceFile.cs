using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using SarabPlatform.Enum;

namespace SarabPlatform.Models
{
    public class ResourceFile
    {
        public int Id { get; set; }
        [Required]
        [MinLength(3)]
        public string FileName { get; set; }
        [Required]
        public FileType FileType { get; set; }
        [Required]
        [JsonIgnore]
        public string? FilePath { get; set; }
        public int Size { get; set; }
        public int SampleId { get; set; }
        public string? Metadata { get; set; }
        public bool IsDeleted { get; set; }
        public int UploadedBy { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UploadedAt { get; set; }
        public DateTime DeletedAt { get; set; }

        [NotMapped]
        public string? EyeSide => GetMetadataValue("EyeSide");

        [NotMapped]
        public string? Gender => GetMetadataValue("Gender");

        [NotMapped]
        public int? Age => GetMetadataInt("Age");

        [NotMapped]
        public string? City => GetMetadataValue("City");

        [NotMapped]
        public string? Status => GetMetadataValue("Status");

        [NotMapped]
        public string? Profession => GetMetadataValue("Profession");

        [NotMapped]
        public string? Notes => GetMetadataValue("Notes");

        private string? GetMetadataValue(string key)
        {
            if (string.IsNullOrWhiteSpace(Metadata))
                return null;

            try
            {
                var root = JsonNode.Parse(Metadata);
                if (root is not JsonObject obj)
                    return null;

                if (!obj.TryGetPropertyValue(key, out var value) || value is null)
                    return null;

                if (value is JsonValue jsonValue)
                {
                    var rawValue = jsonValue.GetValue<object?>();
                    return rawValue?.ToString();
                }

                return value.ToJsonString();
            }
            catch
            {
                return null;
            }
        }

        private int? GetMetadataInt(string key)
        {
            var value = GetMetadataValue(key);
            if (int.TryParse(value, out var result))
                return result;
            return null;
        }
    }
}