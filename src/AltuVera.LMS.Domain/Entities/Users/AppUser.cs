using Microsoft.AspNetCore.Identity;

namespace AltuVera.LMS.Domain.Entities.Users;

public class AppUser : IdentityUser
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? ProfilePictureUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? IndexNo { get; set; }
    public string? BatchCode { get; set; }
    public string? Phone { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();
}

public class UserPreference
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Json { get; set; } = "{}";
}
