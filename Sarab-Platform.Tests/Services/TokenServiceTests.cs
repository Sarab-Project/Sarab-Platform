using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using SarabPlatform.Enum;
using SarabPlatform.Models;
using SarabPlatform.Services;
using Xunit;

namespace SarabPlatform.Tests.Services
{
    public class TokenServiceTests
    {
        private TokenService CreateService()
        {
            var settings = new Dictionary<string, string>
            {
                ["JwtSettings:Key"] = "ThisIsAVeryLongSecretKeyForTesting123",
                ["JwtSettings:Issuer"] = "TestIssuer",
                ["JwtSettings:Audience"] = "TestAudience",
                ["JwtSettings:DurationMinutes"] = "60"
            };

            IConfiguration configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(settings!)
                .Build();

            return new TokenService(configuration);
        }

        private User CreateUser()
        {
            return new User
            {
                Id = 1,
                FirstName = "Ahmed",
                Email = "test@test.com",
                Role = UserRole.Contributor
            };
        }

        [Fact]
        public void GenerateToken_Should_Return_Token()
        {
            var service = CreateService();
            var user = CreateUser();

            var token = service.GenerateToken(user);

            token.Should().NotBeNullOrWhiteSpace();
        }

        [Fact]
        public void GenerateToken_Should_Contain_Email_Claim()
        {
            var service = CreateService();
            var user = CreateUser();

            var token = service.GenerateToken(user);

            var handler = new JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(token);

            jwt.Claims
                .First(x => x.Type == JwtRegisteredClaimNames.Email)
                .Value
                .Should()
                .Be(user.Email);
        }

        [Fact]
        public void GenerateToken_Should_Contain_Role_Claim()
        {
            var service = CreateService();
            var user = CreateUser();

            var token = service.GenerateToken(user);

            var handler = new JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(token);

            jwt.Claims
                .First(x => x.Type == ClaimTypes.Role)
                .Value
                .Should()
                .Be(user.Role.ToString());
        }
    }
}