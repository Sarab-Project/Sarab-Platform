using FluentAssertions;
using Microsoft.AspNetCore.Http;
using SarabPlatform.Enum;
using SarabPlatform.Services;
using Xunit;

namespace SarabPlatform.Tests.Services
{
    public class FileServiceTests
    {
        [Fact]
        public async Task SaveFileAsync_WithVideo_ReturnsVideoType()
        {
            var service = new FileService();

            var content = new MemoryStream(new byte[] { 1, 2, 3 });

            IFormFile file = new FormFile(content, 0, content.Length, "file", "video.mp4")
            {
                Headers = new HeaderDictionary(),
                ContentType = "video/mp4"
            };

            var result = await service.SaveFileAsync(file, Path.GetTempPath());

            result.type.Should().Be(FileType.Video);
        }

        [Fact]
        public async Task SaveFileAsync_WithImage_ReturnsImageType()
        {
            var service = new FileService();

            var content = new MemoryStream(new byte[] { 1, 2, 3 });

            IFormFile file = new FormFile(content, 0, content.Length, "file", "image.png")
            {
                Headers = new HeaderDictionary(),
                ContentType = "image/png"
            };

            var result = await service.SaveFileAsync(file, Path.GetTempPath());

            result.type.Should().Be(FileType.Image);
        }

        [Fact]
        public async Task SaveFileAsync_WithInvalidFile_ThrowsException()
        {
            var service = new FileService();

            var content = new MemoryStream(new byte[] { 1, 2, 3 });

            IFormFile file = new FormFile(content, 0, content.Length, "file", "file.pdf")
            {
                Headers = new HeaderDictionary(),
                ContentType = "application/pdf"
            };

            Func<Task> action = async () =>
                await service.SaveFileAsync(file, Path.GetTempPath());

            await action.Should()
                .ThrowAsync<Exception>()
                .WithMessage("Invalid Content Type");
        }
    }
}