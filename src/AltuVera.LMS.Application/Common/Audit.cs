using AltuVera.LMS.Application.Common.Exceptions;
using AltuVera.LMS.Application.Common.Interfaces;
using AltuVera.LMS.Domain.Entities.Registrar;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.LMS.Application.Common;

public static class AuditExtensions
{
    public static void Audit(this IApplicationDbContext db, ICurrentUserService user, string kind, string target, string detail) =>
        db.AuditLogs.Add(new AuditLog { Actor = user.Name, Role = user.RoleLabel, Kind = kind, Target = target, Detail = detail });

    public static void RequireTeacher(this ICurrentUserService user)
    {
        if (!user.IsTeacher) throw new ForbiddenAccessException();
    }

    public static void RequireAdmin(this ICurrentUserService user)
    {
        if (!user.IsAdmin) throw new ForbiddenAccessException("Only the Assistant Registrar can perform this action.");
    }

    public static async Task<string> CourseLabelAsync(this IApplicationDbContext db, int courseId, CancellationToken ct)
    {
        var c = await db.Courses.AsNoTracking().FirstOrDefaultAsync(x => x.Id == courseId, ct);
        return c is null ? courseId.ToString() : $"{c.ShortName}-{c.FullName}";
    }

    public static async Task<string> UserNameAsync(this IApplicationDbContext db, string userId, CancellationToken ct)
    {
        var u = await db.Users.AsNoTracking().Where(x => x.Id == userId).Select(x => new { x.FirstName, x.LastName }).FirstOrDefaultAsync(ct);
        return u is null ? userId : $"{u.FirstName} {u.LastName}".Trim();
    }

    public static async Task<int> CourseIdOfActivityAsync(this IApplicationDbContext db, int activityId, CancellationToken ct) =>
        await db.Activities.AsNoTracking().Where(a => a.Id == activityId).Select(a => a.Section!.CourseId).FirstOrDefaultAsync(ct);

    public static async Task EnsureStudentCanActAsync(this IApplicationDbContext db, ICurrentUserService user, int activityId, CancellationToken ct)
    {
        if (user.IsTeacher) return;
        var courseId = await db.CourseIdOfActivityAsync(activityId, ct);
        if (!await db.Enrolments.AnyAsync(e => e.CourseId == courseId && e.UserId == user.UserId, ct))
            throw new ForbiddenAccessException("You are not enrolled in this course.");
        var block = await db.AccessBlocks.AsNoTracking().FirstOrDefaultAsync(b => b.StudentId == user.UserId && (b.CourseId == null || b.CourseId == courseId), ct);
        if (block is not null)
            throw new ForbiddenAccessException($"Your access has been restricted by the Assistant Registrar: {block.Reason}");
    }
}
