namespace AltuVera.LMS.Application.Common.Interfaces;

public interface ICurrentUserService
{
    string UserId { get; }
    string Name { get; }
    string Role { get; }
    bool IsAdmin => Role == "Admin";
    bool IsTeacher => Role is "Lecturer" or "Admin";
    string RoleLabel => Role == "Admin" ? "Assistant Registrar" : Role;
}

public interface IFileStorage
{
    Task<string> SaveAsync(Stream content, string fileName, CancellationToken ct);
    Stream? Open(string storedName);
    void Delete(string storedName);
}
