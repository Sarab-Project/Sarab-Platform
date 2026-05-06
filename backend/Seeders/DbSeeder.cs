using SarabPlatform.Data;
using SarabPlatform.Models;
using SarabPlatform.Enum;

namespace Sarab_Platform.Seeders
{
    public static class DbSeeder
    {
        public static async Task SeedAsync(AppDbContext context)
        {
            if (context.Users.Any())
                return;

            var random = new Random();

            // Sample cities
            var cities = new[] { "Damascus", "Aleppo", "Homs", "Hama", "Latakia" };

            // Sample file names
            var fileNames = new[] { "sample1.jpg", "sample2.png", "sample3.mp4", "sample4.jpg", "sample5.mp4" };

            // 🟢 Users
            var users = new List<User>();

            for (int u = 1; u <= 3; u++)
            {
                users.Add(new User
                {
                    FirstName = $"User {u}",
                    LastName = $"Test {u}",
                    Email = $"user{u}@test.com",
                    Role = UserRole.Admin,
                    PasswordHash = "hashedpassword" // Use a proper hash in production
                });
            }

            await context.Users.AddRangeAsync(users);
            await context.SaveChangesAsync();

            var collections = new List<Collection>();
            var folders = new List<Folder>();
            var samples = new List<Sample>();
            var files = new List<ResourceFile>();

            foreach (var user in users)
            {
                // 🟢 لكل user → collections
                for (int c = 1; c <= 2; c++)
                {
                    var collection = new Collection
                    {
                        Name = $"Collection {c} - User {user.Id}",
                        CreatedBy = user.Id
                    };

                    collections.Add(collection);
                }
            }

            await context.Collections.AddRangeAsync(collections);
            await context.SaveChangesAsync();

            foreach (var collection in collections)
            {
                var user = users.First(u => u.Id == collection.CreatedBy);

                // 🟢 folders داخل collection
                for (int f = 1; f <= 2; f++)
                {
                    var folder = new Folder
                    {
                        Name = $"Folder {f}",
                        CollectionId = collection.Id,
                        CreatedBy = user.Id
                    };

                    folders.Add(folder);
                }
            }

            await context.Folders.AddRangeAsync(folders);
            await context.SaveChangesAsync();

            foreach (var folder in folders)
            {
                var user = users.First(u => u.Id == folder.CreatedBy);

                // 🟢 samples داخل folder
                for (int s = 1; s <= 3; s++)
                {
                    var sample = new Sample
                    {
                        FolderId = folder.Id,
                        Title = $"Sample {s} in Folder {folder.Name}",
                        Description = $"Description for sample {s}",
                        Metadata = "{}",
                        Gender = random.Next(2) == 0 ? "male" : "female",
                        Age = random.Next(18, 60),
                        City = cities[random.Next(cities.Length)],
                        Status = "single",
                        CreatedBy = user.Id
                    };

                    samples.Add(sample);
                }
            }

            await context.Samples.AddRangeAsync(samples);
            await context.SaveChangesAsync();

            foreach (var sample in samples)
            {
                var user = users.First(u => u.Id == sample.CreatedBy);

                // 🟢 files داخل sample
                for (int fi = 0; fi < 2; fi++)
                {
                    var fileName = fileNames[random.Next(fileNames.Length)];

                    files.Add(new ResourceFile
                    {
                        SampleId = sample.Id,
                        FileName = fileName,
                        FilePath = Path.Combine("uploads/seed", fileName),
                        FileType = fileName.EndsWith(".mp4") ? FileType.Video : FileType.Image,
                        Size = random.Next(1000, 10000), // Sample size
                        UploadedBy = user.Id
                    });
                }
            }

            await context.Files.AddRangeAsync(files);
            await context.SaveChangesAsync();
        }
    }
}
        