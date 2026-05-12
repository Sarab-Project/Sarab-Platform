using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace SarabPlatform.Models
{
    public class Sample
    {
        public int Id { get; set; }
        [Required]
        public string? Title { get; set; }
        public int? FolderId { get; set; }
        public Folder? Folder { get; set; }
        public string? Description { get; set; }
        public int CreatedBy { get; set; }
        public int DownloadCount { get; set; }
        [Required]
        public string? Metadata { get; set; }
        public List<ResourceFile> Files { get; set; } = new();
        public List<Tag>? Tags { get; set; } = new();
        public bool IsDeleted { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdateAt { get; set; }
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

        private Dictionary<string, JsonElement> GetMetadataJson()
        {
            if (string.IsNullOrWhiteSpace(Metadata))
                return new Dictionary<string, JsonElement>();

            try
            {
                using var document = JsonDocument.Parse(Metadata);
                if (document.RootElement.ValueKind != JsonValueKind.Object)
                    return new Dictionary<string, JsonElement>();

                return document.RootElement.EnumerateObject()
                    .ToDictionary(p => p.Name, p => p.Value);
            }
            catch
            {
                return new Dictionary<string, JsonElement>();
            }
        }

        private string? GetMetadataValue(string key)
        {
            var json = GetMetadataJson();
            if (json.TryGetValue(key, out var element))
            {
                return element.ValueKind switch
                {
                    JsonValueKind.String => element.GetString(),
                    JsonValueKind.Number => element.GetRawText(),
                    JsonValueKind.True => "True",
                    JsonValueKind.False => "False",
                    _ => element.ToString(),
                };
            }
            return null;
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