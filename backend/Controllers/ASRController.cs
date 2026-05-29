using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using SarabPlatform.Dto;
using SarabPlatform.Services;
using Xabe.FFmpeg;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ASRController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;

        public ASRController(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;

            // Direct path to the standard Linux installation directory
            FFmpeg.SetExecutablesPath("/usr/bin");
        }

        [HttpPost]
        public async Task<IActionResult> ProcessVoice([FromForm] ASRDto dto)
        {
            // 1. التحقق من وجود الملف القادم من تطبيق الـ React Native
            if (dto.AudioFile == null || dto.AudioFile.Length == 0)
                return BadRequest("الملف الصوتي مفقود");

            var tempInput = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + Path.GetExtension(dto.AudioFile.FileName));
            var tempOutput = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + ".wav");

            try
            {
                // 2. حفظ الملف الأصلي مؤقتاً
                using (var stream = new FileStream(tempInput, FileMode.Create))
                {
                    await dto.AudioFile.CopyToAsync(stream);
                }

                // 3. التحويل إلى تنسيق WAV PCM 16-bit
                await FFmpeg.Conversions.New()
                    .AddParameter($"-i \"{tempInput}\"")
                    .AddParameter("-acodec pcm_s16le") 
                    .AddParameter("-ar 16000")        
                    .AddParameter("-ac 1")            
                    .SetOutput(tempOutput)
                    .Start();

                // 4. إعداد الاتصال بالخدمة الخارجية (FastAPI)
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromMinutes(3);

                string externalUrl = $"http://25.9.129.103:8000/api/Samples/{4}/analyze?encode=true&task=transcribe&output=txt";

                using var content = new MultipartFormDataContent();
                using var fileStream = System.IO.File.OpenRead(tempOutput);
                var fileContent = new StreamContent(fileStream);
                
                fileContent.Headers.ContentType = new MediaTypeHeaderValue("audio/vnd.wave");
                content.Add(fileContent, "audioFile", "audio.wav");

                // 5. إرسال الطلب واستلام الرد
                var response = await client.PostAsync(externalUrl, content);
                var jsonResult = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    return Content(jsonResult, "application/json");
                }

                return StatusCode((int)response.StatusCode, jsonResult);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"خطأ داخلي في السيرفر: {ex.Message}");
            }
            finally
            {
                // 6. تنظيف الملفات المؤقتة
                if (System.IO.File.Exists(tempInput)) System.IO.File.Delete(tempInput);
                if (System.IO.File.Exists(tempOutput)) System.IO.File.Delete(tempOutput);
            }
        }
    }
}