using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SarabPlatform.Data;
using SarabPlatform.Enum;
using SarabPlatform.Models;
using SarabPlatform.Services;

var builder = WebApplication.CreateBuilder(args);

// Original setup
builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);

builder.Services.AddScoped<FileService>();
builder.Services.AddScoped<TokenService>();

// Database configuration
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Authentication setup
var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>()!;
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Key));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = key
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
    options.AddPolicy("ContributorOrAdmin", policy => policy.RequireRole("Admin", "Contributor"));
    options.AddPolicy("CanCreateGroups", policy => policy.RequireRole("Admin", "Contributor", "Researcher"));
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options => options.AddPolicy("AllowAll", policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.UseSwagger();
app.UseSwaggerUI();
app.MapGet("/", () => "Root endpoint!");

app.Run();

// Original Seed Methods
static void SeedDefaults(AppDbContext db, string contentRootPath)
{
    var admin = db.Users.FirstOrDefault(u => u.Email == "admin@sarab.com");

    if (admin == null)
    {
        db.Users.Add(new User
        {
            FirstName = "Admin",
            LastName = "Sarab",
            Email = "admin@sarab.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin"),
            Role = UserRole.Admin,
            CreatedAt = DateTime.UtcNow,
            IsActive = true,
            IsVerified = true,
            IsEmailVerified = true
        });
    }
    else if (admin.Role != UserRole.Admin || !admin.IsActive)
    {
        admin.Role = UserRole.Admin;
        admin.IsActive = true;
        admin.IsVerified = true;
        admin.IsEmailVerified = true;
    }

    db.SaveChanges();
    SeedTags(db, Path.Combine(contentRootPath, "tags.json"));
}

static void SeedTags(AppDbContext db, string jsonPath)
{
    if (!File.Exists(jsonPath))
        return;

    var tags = JsonSerializer.Deserialize<List<TagSeedData>>(File.ReadAllText(jsonPath));
    if (tags == null || tags.Count == 0)
        return;

    var existingTags = db.Tags.ToDictionary(t => t.Name?.ToLowerInvariant() ?? string.Empty, StringComparer.OrdinalIgnoreCase);
    var changed = false;

    foreach (var tag in tags)
    {
        if (string.IsNullOrWhiteSpace(tag.name))
            continue;

        var normalized = tag.name.Trim();
        if (!existingTags.TryGetValue(normalized.ToLowerInvariant(), out var existing))
        {
            db.Tags.Add(new Tag { Name = normalized });
            changed = true;
            continue;
        }

        if (existing.Name != normalized)
        {
            existing.Name = normalized;
            changed = true;
        }
    }

    if (changed)
        db.SaveChanges();
}

internal sealed class TagSeedData { public string? name { get; set; } }