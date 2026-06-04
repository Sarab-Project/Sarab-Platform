using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using SarabPlatform.Dto;
using SarabPlatform.Services;
using Xabe.FFmpeg;

namespace SarabPlatform.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "ContributorOrAdmin")]
    public class ASRController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;

        public ASRController(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;

            FFmpeg.SetExecutablesPath("/usr/bin");
        }

        [HttpPost]
        public async Task<IActionResult> ProcessVoice([FromForm] ASRDto dto)
        {
            if (dto.AudioFile == null || dto.AudioFile.Length == 0)
                return BadRequest("No audio file uploaded.");

            var tempInput = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + Path.GetExtension(dto.AudioFile.FileName));
            var tempOutput = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + ".wav");

            try
            {
                using (var stream = new FileStream(tempInput, FileMode.Create))
                {
                    await dto.AudioFile.CopyToAsync(stream);
                }

                await FFmpeg.Conversions.New()
                    .AddParameter($"-i \"{tempInput}\"")
                    .AddParameter("-acodec pcm_s16le") 
                    .AddParameter("-ar 16000")        
                    .AddParameter("-ac 1")            
                    .SetOutput(tempOutput)
                    .Start();

                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromMinutes(3);

                string externalUrl = $"http://25.9.129.103:8000/api/Samples/{4}/analyze?encode=true&task=transcribe&output=txt";

                using var content = new MultipartFormDataContent();
                using var fileStream = System.IO.File.OpenRead(tempOutput);
                var fileContent = new StreamContent(fileStream);
                
                fileContent.Headers.ContentType = new MediaTypeHeaderValue("audio/vnd.wave");
                content.Add(fileContent, "audioFile", "audio.wav");

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
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
            finally
            {
                if (System.IO.File.Exists(tempInput)) System.IO.File.Delete(tempInput);
                if (System.IO.File.Exists(tempOutput)) System.IO.File.Delete(tempOutput);
            }
        }
    }
}