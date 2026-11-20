using AltuVera.LMS.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace AltuVera.LMS.Infrastructure.Services;

public class LocalFileStorage(IConfiguration configuration) : IFileStorage
{
    private readonly string _root = Path.GetFullPath(configuration["Storage:UploadsPath"] ?? Path.Combine(AppContext.BaseDirectory, "App_Data", "uploads"));

    public async Task<string> SaveAsync(Stream content, string fileName, CancellationToken ct)
    {
        Directory.CreateDirectory(_root);
        var stored = $"{Guid.NewGuid():N}{Path.GetExtension(fileName).ToLowerInvariant()}";
        await using var fs = File.Create(Path.Combine(_root, stored));
        await content.CopyToAsync(fs, ct);
        return stored;
    }

    public Stream? Open(string storedName)
    {
        var path = Resolve(storedName);
        return path is not null && File.Exists(path) ? File.OpenRead(path) : null;
    }

    public void Delete(string storedName)
    {
        var path = Resolve(storedName);
        if (path is not null && File.Exists(path)) File.Delete(path);
    }

    private string? Resolve(string storedName)
    {
        if (string.IsNullOrWhiteSpace(storedName) || storedName != Path.GetFileName(storedName)) return null;
        return Path.Combine(_root, storedName);
    }
}
