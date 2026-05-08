using Xabe.FFmpeg;

namespace SarabPlatform.Services
{
    public class AudioService
{
    private readonly string _ffmpegPath = @"C:\Program Files\ffmpeg-2026-03-15-git-6ba0b59d8b-full_build\bin\"; // تأكد من المسار الفعلي على جهازك

    public AudioService()
    {
        FFmpeg.SetExecutablesPath(_ffmpegPath);
    }

    public async Task<string> ConvertToWavAsync(string inputFile)
    {
        var outputFile = Path.ChangeExtension(Path.GetTempFileName(), ".wav");

        try
        {
            // إعدادات التحويل لضمان أعلى توافق مع خدمات ASR
            var conversion = await FFmpeg.Conversions.New()
                .AddParameter($"-i \"{inputFile}\"")
                .AddParameter("-acodec pcm_s16le") // ترميز WAV الخام
                .AddParameter("-ar 16000")        // تردد 16 كيلو هيرتز
                .AddParameter("-ac 1")            // Mono (قناة واحدة)
                .SetOutput(outputFile)
                .Start();

            return outputFile;
        }
        catch (Exception ex)
        {
            // تنظيف في حال الفشل
            if (File.Exists(outputFile)) File.Delete(outputFile);
            throw new Exception($"فشل تحويل الصوت: {ex.Message}");
        }
    }
}
}