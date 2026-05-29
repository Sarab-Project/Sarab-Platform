using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
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
        public string? EyeSide => GetMetadataValueFromFirstFile("EyeSide");

        [NotMapped]
        public string? Gender => GetMetadataValueFromFirstFile("Gender");

        [NotMapped]
        public int? Age => GetMetadataIntFromFirstFile("Age");

        [NotMapped]
        public string? City => GetMetadataValueFromFirstFile("City");

        [NotMapped]
        public string? Status => GetMetadataValueFromFirstFile("Status");

        [NotMapped]
        public string? Profession => GetMetadataValueFromFirstFile("Profession");

        [NotMapped]
        public string? Notes => GetMetadataValueFromFirstFile("Notes");

        private string? GetMetadataValueFromFirstFile(string key)
        {
            var firstFile = Files?.FirstOrDefault();
            if (firstFile == null)
                return null;

            if (string.IsNullOrWhiteSpace(firstFile.Metadata))
                return null;

            try
            {
                var root = JsonNode.Parse(firstFile.Metadata);
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

        public string? Metadata { get; set; }

        private int? GetMetadataIntFromFirstFile(string key)
        {
            var value = GetMetadataValueFromFirstFile(key);
            if (int.TryParse(value, out var result))
                return result;
            return null;
        }
    }
}