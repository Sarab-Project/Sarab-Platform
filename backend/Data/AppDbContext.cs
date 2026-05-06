using Microsoft.EntityFrameworkCore;
using SarabPlatform.Models;

namespace SarabPlatform.Data
{
    public class AppDbContext : DbContext
    {
        public DbSet<User> Users { get; set; }
        public DbSet<Group> Groups { get; set; }
        public DbSet<Collection> Collections { get; set; }
        public DbSet<Folder> Folders { get; set; }
        public DbSet<Sample> Samples { get; set; }
        public DbSet<ResourceFile> Files { get; set; }
        public DbSet<GroupMember> GroupMembers { get; set; }
        public DbSet<Tag> Tags { get; set; }
        public DbSet<UserDocument> UserDocuments { get; set; }
        public DbSet<UserSession> UserSessions { get; set; }
        public DbSet<CollectionTemplate> CollectionTemplates { get; set; }
    
        public AppDbContext(DbContextOptions<AppDbContext>options) : base(options){}

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>()
            .HasIndex(x => x.Email)
            .IsUnique();
            
            modelBuilder.Entity<User>()
            .Property(x => x.CreatedAt)
            .HasDefaultValueSql("GETUTCDATE()");

            modelBuilder.Entity<Folder>()
            .HasOne( f => f.Parent)
            .WithMany( f => f.Children)
            .HasForeignKey( f => f.ParentId)
            .OnDelete( DeleteBehavior.Restrict);

            modelBuilder.Entity<Folder>()
            .HasOne(f => f.Collection)
            .WithMany(c => c.Folders)
            .HasForeignKey(f => f.CollectionId)
            .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Folder>()
            .HasOne(f => f.CreatedByUser)
            .WithMany(u => u.Folders)
            .HasForeignKey(f => f.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserDocument>()
                .HasOne(d => d.User)
                .WithOne(u => u.Document)
                .HasForeignKey<UserDocument>(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserDocument>()
                .HasIndex(d => d.UserId)
                .IsUnique();

            modelBuilder.Entity<GroupMember>()
                .HasOne(m => m.Group)
                .WithMany(g => g.Members)
                .HasForeignKey(m => m.GroupId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<GroupMember>()
                .HasOne(m => m.User)
                .WithMany(u => u.Groups)
                .HasForeignKey(m => m.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Collection>()
                .HasOne(c => c.CreatedByUser)
                .WithMany(u => u.Collections)
                .HasForeignKey(c => c.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Collection>()
                .HasOne(c => c.Group)
                .WithMany(g => g.Collections)
                .HasForeignKey(c => c.GroupId)
                .OnDelete(DeleteBehavior.SetNull);
        }


    }
}