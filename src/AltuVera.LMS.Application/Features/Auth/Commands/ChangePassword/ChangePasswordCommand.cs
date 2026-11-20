using AltuVera.LMS.Application.Common.Models;
using MediatR;

namespace AltuVera.LMS.Application.Features.Auth.Commands.ChangePassword;

public record ChangePasswordCommand(string UserId, string CurrentPassword, string NewPassword) : IRequest<Result<bool>>;
