using Xabe.FFmpeg;

namespace SarabPlatform.Services
{
    public class AudioService
{
    public AudioService()
    {
        FFmpeg.SetExecutablesPath("/usr/bin");
    }

    public async Task<string> ConvertToWavAsync(string inputFile)
    {
        var outputFile = Path.ChangeExtension(Path.GetTempFileName(), ".wav");

        try
        {
            var conversion = await FFmpeg.Conversions.New()
                .AddParameter($"-i \"{inputFile}\"")
                .AddParameter("-acodec pcm_s16le")
                .AddParameter("-ar 16000")
                .AddParameter("-ac 1")
                .SetOutput(outputFile)
                .Start();

            return outputFile;
        }
        catch (Exception ex)
        {
            if (File.Exists(outputFile)) File.Delete(outputFile);
            throw new Exception($"فشل تحويل الصوت: {ex.Message}");
        }
    }
}
}