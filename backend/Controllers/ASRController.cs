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
        private readonly string _ffmpegPath = @"C:\Program Files\ffmpeg-2026-03-15-git-6ba0b59d8b-full_build\bin";
        public ASRController(IHttpClientFactory httpClientFactory)
        {
        _httpClientFactory = httpClientFactory;
        // إعداد المسار مرة واحدة عند تشغيل الـ Controller
        FFmpeg.SetExecutablesPath(_ffmpegPath);
        }

        // [HttpPost]
        // public async Task<IActionResult> ProcessVoice([FromForm] IFormFile AudioFile)
        // {
        //     if (AudioFile == null || AudioFile.Length == 0)
        //         return BadRequest(new { message = "الملف الصوتي مفقود" });

        //     // رابط الخدمة الخارجية التي تحلل الصوت وتعيد JSON
        //     string externalAsrServiceUrl = "http://25.9.129.103:8000";

        //     var client = _httpClientFactory.CreateClient();

        //     using var content = new MultipartFormDataContent();
        //     using var stream = AudioFile.OpenReadStream();
        //     var fileContent = new StreamContent(stream);
            
        //     // تمرير الـ Content-Type الأصلي للملف (مثلاً audio/m4a)
        //     fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(AudioFile.ContentType);

        //     // إضافة الملف للطلب الموجه للخدمة الخارجية
        //     content.Add(fileContent, "audio", AudioFile.FileName); 

        //     try
        //     {
        //         // إرسال الملف وانتظار الـ JSON من خدمة الـ AI
        //         var response = await client.PostAsync(externalAsrServiceUrl, content);
                
        //         // قراءة الـ JSON الناتج (مثال: { "age": 25, "gender": "male" ... })
        //         var jsonResponse = await response.Content.ReadAsStringAsync();

        //         if (response.IsSuccessStatusCode)
        //         {
        //             // إرسال الـ JSON مباشرة للموبايل بصيغة application/json
        //             return Content(jsonResponse, "application/json");
        //         }

        //         return StatusCode((int)response.StatusCode, jsonResponse);
        //     }
        //     catch (Exception ex)
        //     {
        //         return StatusCode(500, new { message = "خطأ في الاتصال بخدمة الـ AI", details = ex.Message });
        //     }
        // }


        // [HttpPost]
        // // [ApiExplorerSettings(IgnoreApi = true)]
        // [Consumes("multipart/form-data")]
        // public async Task<IActionResult> ProcessVoice([FromForm] ASRDto AudioFile)
        // {
        //     // سنقوم بتعطيل الاتصال الخارجي مؤقتاً للاختبار
        //     // 1. نتأكد فقط أن الملف وصل للسيرفر
        //     if (AudioFile == null || AudioFile.AudioFile.Length == 0)
        //         return BadRequest(new { message = "الملف لم يصل للسيرفر" });

        //     // 2. محاكاة تأخير بسيط (وكأن السيرفر يعالج الصوت)
        //     await Task.Delay(1500); 

        //     // 3. إعادة JSON وهمي بنفس الصيغة التي يتوقعها الموبايل
        //     var mockResult = new {
        //         Eyeside = "Right",
        //         Gender = "Male",
        //         Age = "25",
        //         City = "Damascus",
        //         Status = "Single",
        //         Profession = "Software Developer",
        //         Notes = "تم استلام الصوت بنجاح وهذا رد وهمي للاختبار"
        //     };

        //     return Ok(mockResult);
        // }




    [HttpPost]
    public async Task<IActionResult> ProcessVoice([FromForm] ASRDto dto)
    {
        // 1. التحقق من وجود الملف القادم من تطبيق الـ React Native
        if (dto.AudioFile == null || dto.AudioFile.Length == 0)
            return BadRequest("الملف الصوتي مفقود");

        // إنشاء مسارات للملفات المؤقتة في السيرفر
        var tempInput = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + Path.GetExtension(dto.AudioFile.FileName));
        var tempOutput = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + ".wav");

        try
        {
            // 2. حفظ الملف الأصلي (m4a/mp3) مؤقتاً
            using (var stream = new FileStream(tempInput, FileMode.Create))
            {
                await dto.AudioFile.CopyToAsync(stream);
            }

            // 3. التحويل إلى تنسيق WAV PCM 16-bit (المطلوب للخدمة الخارجية)
            await FFmpeg.Conversions.New()
                .AddParameter($"-i \"{tempInput}\"")
                .AddParameter("-acodec pcm_s16le") 
                .AddParameter("-ar 16000")        
                .AddParameter("-ac 1")            
                .SetOutput(tempOutput)
                .Start();

            // 4. إعداد الاتصال بالخدمة الخارجية (FastAPI)
            var client = _httpClientFactory.CreateClient();
            
            // رفع الـ Timeout لأن معالجة الـ LLM (Qwen) تأخذ وقتاً طويلاً
            client.Timeout = TimeSpan.FromMinutes(3);

            // بناء الرابط مع الـ Query Parameters المطلوبة في main.py
            // string sampleId = "sarab-ai-" + Guid.NewGuid().ToString().Substring(0, 8);
            string externalUrl = $"http://25.9.129.103:8000/api/Samples/{4}/analyze?encode=true&task=transcribe&output=txt";

            using var content = new MultipartFormDataContent();
            using var fileStream = System.IO.File.OpenRead(tempOutput);
            var fileContent = new StreamContent(fileStream);
            
            // استخدام النوع المتوافق مع Swagger الخاص بالخدمة
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("audio/vnd.wave");

            // ملاحظة: تم تغيير الاسم إلى "audioFile" ليطابق كود البايثون تماماً
            content.Add(fileContent, "audioFile", "audio.wav");

            // 5. إرسال الطلب واستلام الرد
            var response = await client.PostAsync(externalUrl, content);
            var jsonResult = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // إعادة النتيجة (التي تحتوي على الحقول الموزعة) للموبايل
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
            // 6. تنظيف الملفات المؤقتة فوراً لضمان عدم امتلاء القرص الصلب
            if (System.IO.File.Exists(tempInput)) System.IO.File.Delete(tempInput);
            if (System.IO.File.Exists(tempOutput)) System.IO.File.Delete(tempOutput);
        }
    }
        
    }
}