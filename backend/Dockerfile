FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 5027

ENV ASPNETCORE_URLS=http://+:5027

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG configuration=Release
WORKDIR /src
COPY ["Sarab-Platform.csproj", "./"]
RUN dotnet restore "Sarab-Platform.csproj"
COPY . .
WORKDIR "/src/."
RUN dotnet build "Sarab-Platform.csproj" -c $configuration -o /app/build

FROM build AS publish
ARG configuration=Release
RUN dotnet publish "Sarab-Platform.csproj" -c $configuration -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app

COPY --from=publish /app/publish .

RUN mkdir -p /app/Uploads && chown -R app:app /app/Uploads

USER app

ENTRYPOINT ["dotnet", "Sarab-Platform.dll"]