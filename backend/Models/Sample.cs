using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

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
        public User? CreatedByUser { get; set; }
        public int ViewCount { get; set; }
        public int DownloadCount { get; set; }
        public List<ResourceFile> Files { get; set; } = new();
        public List<Tag>? Tags { get; set; } = new();
        public bool IsDeleted { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdateAt { get; set; }
        public DateTime DeletedAt { get; set; }

        [NotMapped]
        public string? EyeSide => GetMetadataValue("EyeSide");

        [NotMapped]
        public string? Gender => NormalizeGender(GetMetadataValue("Gender"));

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
            if (string.IsNullOrWhiteSpace(key))
                return null;

            if (!string.IsNullOrWhiteSpace(Metadata))
            {
                var metadataValue = TryGetMetadataValue(Metadata, key);
                if (!string.IsNullOrWhiteSpace(metadataValue))
                    return metadataValue;
            }

            if (Files != null)
            {
                foreach (var file in Files)
                {
                    if (string.IsNullOrWhiteSpace(file.Metadata))
                        continue;

                    var metadataValue = TryGetMetadataValue(file.Metadata, key);
                    if (!string.IsNullOrWhiteSpace(metadataValue))
                        return metadataValue;
                }
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

        private static string? TryGetMetadataValue(string json, string key)
        {
            try
            {
                var metadata = JsonSerializer.Deserialize<Dictionary<string, object>>(json);
                if (metadata != null && metadata.TryGetValue(key, out var value))
                {
                    return value?.ToString();
                }
            }
            catch
            {
            }

            return null;
        }

        private static string? NormalizeGender(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            var cleaned = value.Trim();
            if (string.Equals(cleaned, "male", StringComparison.OrdinalIgnoreCase))
                return "Male";
            if (string.Equals(cleaned, "female", StringComparison.OrdinalIgnoreCase))
                return "Female";
            if (string.Equals(cleaned, "other", StringComparison.OrdinalIgnoreCase))
                return "Other";

            return CultureInfo.CurrentCulture.TextInfo.ToTitleCase(cleaned.ToLowerInvariant());
        }

        public string? Metadata { get; set; }
    }
}