using System.Security.Claims;
using AltuVera.LMS.Application.Common.Interfaces;

namespace AltuVera.LMS.API.Services;

public class CurrentUserService(IHttpContextAccessor accessor) : ICurrentUserService
{
    private ClaimsPrincipal? User => accessor.HttpContext?.User;
    public string UserId => User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
    public string Name => User?.FindFirstValue(ClaimTypes.Name) ?? "System";
    public string Role => User?.FindFirstValue(ClaimTypes.Role) ?? "Student";
}
