using SarabPlatform.Enum;

namespace SarabPlatform.Services
{
    public class FileService
    {
        public async Task<(string path , FileType type)> SaveFileAsync(IFormFile file, string folderPath)
        {
            FileType fileType;

            if (file.ContentType.StartsWith("video/"))
            {
                fileType = FileType.Video;
            }
            else if (file.ContentType.StartsWith("image/"))
            {
                fileType = FileType.Image;
            }
            else if (file.ContentType.StartsWith("audio/"))
            {
                fileType = FileType.Audio;
            }
            else
            {
                throw new Exception("Invalid Content Type");
            }
            
            var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName);
            var filePath = Path.Combine(folderPath,fileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }
            return (filePath,fileType);
        }
    }
}