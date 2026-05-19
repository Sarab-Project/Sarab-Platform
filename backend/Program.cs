using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SarabPlatform.Data;
using SarabPlatform.Enum;
using SarabPlatform.Models;
using SarabPlatform.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

builder.Services.AddScoped<FileService>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"))
);

var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>();
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings!.Key));

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = key
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
    options.AddPolicy("ContributorOrAdmin", policy => policy.RequireRole("Admin", "Contributor"));
    options.AddPolicy("CanCreateGroups", policy => policy.RequireRole("Admin", "Contributor", "Researcher"));
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
    options.AddPolicy("AllowAll",
    policy =>
    {
        policy.AllowAnyOrigin()
        .AllowAnyMethod()
        .AllowAnyHeader();
    })
);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var existingAdmin = dbContext.Users.FirstOrDefault(u => u.Email == "admin@sarab.com");
    if (existingAdmin == null)
    {
        var passwordHash = BCrypt.Net.BCrypt.HashPassword("admin");
        dbContext.Users.Add(new User
        {
            FirstName = "Admin",
            LastName = "Sarab",
            Email = "admin@sarab.com",
            PasswordHash = passwordHash,
            Role = UserRole.Admin,
            CreatedAt = DateTime.UtcNow,
            IsActive = true,
            IsVerified = true,
            IsEmailVerified = true
        });
        dbContext.SaveChanges();
    }
    else if (existingAdmin.Role != UserRole.Admin || !existingAdmin.IsActive)
    {
        existingAdmin.Role = UserRole.Admin;
        existingAdmin.IsActive = true;
        existingAdmin.IsVerified = true;
        existingAdmin.IsEmailVerified = true;
        dbContext.SaveChanges();
    }

    // Seed tags from JSON file
    try
    {
        var tagsJsonPath = Path.Combine(Directory.GetCurrentDirectory(), "tags.json");
        var forceReset = Environment.GetEnvironmentVariable("FORCE_TAG_RESET")?.ToLowerInvariant() == "true";

        if (File.Exists(tagsJsonPath))
        {
            var tagsJson = File.ReadAllText(tagsJsonPath);
            var tagData = System.Text.Json.JsonSerializer.Deserialize<List<TagSeedData>>(tagsJson);

            if (tagData != null && tagData.Any())
            {
                var existingTags = dbContext.Tags.ToList();
                var tagsAdded = 0;
                var tagsUpdated = 0;

                if (forceReset)
                {
                    // Force reset: clear all existing tags
                    dbContext.Tags.RemoveRange(dbContext.Tags);
                    dbContext.SaveChanges();

                    // Add all tags from JSON
                    var tags = tagData.Select(td => new Tag { Name = td.name }).ToList();
                    dbContext.Tags.AddRange(tags);
                    dbContext.SaveChanges();

                    Console.WriteLine($"Force reset: cleared all existing tags and added {tags.Count} new tags from tags.json");
                }
                else
                {
                    // Smart seeding: preserve existing tags and relationships
                    foreach (var tagSeed in tagData)
                    {
                        var existingTag = existingTags.FirstOrDefault(t => t.Name?.ToLowerInvariant() == tagSeed.name?.ToLowerInvariant());
                        if (existingTag == null)
                        {
                            // Add new tag
                            dbContext.Tags.Add(new Tag { Name = tagSeed.name });
                            tagsAdded++;
                        }
                        else
                        {
                            // Update existing tag name if it has changed (case-insensitive)
                            if (existingTag.Name != tagSeed.name)
                            {
                                existingTag.Name = tagSeed.name;
                                tagsUpdated++;
                            }
                        }
                    }

                    if (tagsAdded > 0 || tagsUpdated > 0)
                    {
                        dbContext.SaveChanges();
                        Console.WriteLine($"Tag seeding complete: {tagsAdded} added, {tagsUpdated} updated");
                    }
                    else
                    {
                        Console.WriteLine("All tags from tags.json already exist in database");
                    }
                }
            }
        }
        else
        {
            Console.WriteLine("tags.json file not found. Skipping tag seeding.");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error seeding tags: {ex.Message}");
    }
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.UseSwagger();
app.UseSwaggerUI();
app.MapGet("/", () => "Root endpoint!");

app.Run();

public class TagSeedData
{
    public string? name { get; set; }
}


