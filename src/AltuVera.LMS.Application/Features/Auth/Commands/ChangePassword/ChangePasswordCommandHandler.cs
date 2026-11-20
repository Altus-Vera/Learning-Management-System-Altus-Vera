using AltuVera.LMS.Application.Common.Models;
using AltuVera.LMS.Domain.Entities.Users;
using MediatR;
using Microsoft.AspNetCore.Identity;

namespace AltuVera.LMS.Application.Features.Auth.Commands.ChangePassword;

public class ChangePasswordCommandHandler(UserManager<AppUser> userManager)
    : IRequestHandler<ChangePasswordCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(request.UserId);
        if (user is null || !user.IsActive)
            return Result<bool>.Failure("User not found.");

        if (!await userManager.CheckPasswordAsync(user, request.CurrentPassword))
            return Result<bool>.Failure("Invalid current password.");

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
            return Result<bool>.Failure(string.Join(" ", result.Errors.Select(e => e.Description)));

        return Result<bool>.Success(true);
    }
}
