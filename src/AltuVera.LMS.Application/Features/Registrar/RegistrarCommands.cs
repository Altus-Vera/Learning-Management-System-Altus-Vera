using AltuVera.LMS.Application.Common;
using AltuVera.LMS.Application.Common.Exceptions;
using AltuVera.LMS.Application.Common.Interfaces;
using AltuVera.LMS.Domain.Entities.Academics;
using AltuVera.LMS.Domain.Entities.Assessment;
using AltuVera.LMS.Domain.Entities.Messaging;
using AltuVera.LMS.Domain.Entities.Registrar;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.LMS.Application.Features.Registrar;

internal static class RegistrarRules { public const string PaymentReason = "Outstanding payment for coursework"; }

// ── Blocks ───────────────────────────────────────────────────────────────────

public record BlockStudentsCommand(string[] StudentIds, int? CourseId, string Reason) : IRequest;

public class BlockStudentsHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<BlockStudentsCommand>
{
    public async Task Handle(BlockStudentsCommand c, CancellationToken ct)
    {
        user.RequireAdmin();
        if (string.IsNullOrWhiteSpace(c.Reason)) throw new BusinessRuleException("A reason is required.");
        var label = c.CourseId is null ? null : await db.CourseLabelAsync(c.CourseId.Value, ct);
        foreach (var sid in c.StudentIds.Distinct())
        {
            if (await db.AccessBlocks.AnyAsync(b => b.StudentId == sid && b.CourseId == c.CourseId, ct)) continue;
            db.AccessBlocks.Add(new AccessBlock { StudentId = sid, CourseId = c.CourseId, Reason = c.Reason.Trim(), BlockedBy = user.Name });
            db.Notifications.Add(new Notification { UserId = sid, Component = "System", Subject = "Your access has been restricted", Text = $"{(label is null ? "Your account" : label)} has been restricted by the Assistant Registrar: {c.Reason.Trim()}", Link = "/dashboard" });
            db.Audit(user, "block", await db.UserNameAsync(sid, ct), label is null ? $"Account blocked: {c.Reason}" : $"Blocked from course {label}: {c.Reason}");
        }
        await db.SaveChangesAsync(ct);
    }
}

public record UnblockStudentsCommand(string[] StudentIds, int? CourseId, bool All) : IRequest;

public class UnblockStudentsHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<UnblockStudentsCommand>
{
    public async Task Handle(UnblockStudentsCommand c, CancellationToken ct)
    {
        user.RequireAdmin();
        var blocks = await db.AccessBlocks.Where(b => c.StudentIds.Contains(b.StudentId) && (c.All || b.CourseId == c.CourseId)).ToListAsync(ct);
        foreach (var b in blocks)
            db.Audit(user, "unblock", await db.UserNameAsync(b.StudentId, ct), b.CourseId is null ? "Account unblocked" : $"Unblocked from course {await db.CourseLabelAsync(b.CourseId.Value, ct)}");
        db.AccessBlocks.RemoveRange(blocks);
        await db.SaveChangesAsync(ct);
    }
}

// ── Payments ─────────────────────────────────────────────────────────────────

public record SetPaymentCommand(int CourseId, string StudentId, bool Paid) : IRequest;

public class SetPaymentHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<SetPaymentCommand>
{
    public async Task Handle(SetPaymentCommand c, CancellationToken ct)
    {
        user.RequireAdmin();
        var p = await db.Payments.FirstOrDefaultAsync(x => x.CourseId == c.CourseId && x.StudentId == c.StudentId, ct);
        if (p is null) { p = new Payment { CourseId = c.CourseId, StudentId = c.StudentId, DueDate = DateTime.UtcNow }; db.Payments.Add(p); }
        p.Paid = c.Paid;
        p.PaidAt = c.Paid ? DateTime.UtcNow : null;
        p.Reference = c.Paid ? (string.IsNullOrEmpty(p.Reference) ? $"AV-{c.CourseId}-{DateTime.UtcNow:HHmmss}" : p.Reference) : "";
        var label = await db.CourseLabelAsync(c.CourseId, ct);
        var name = await db.UserNameAsync(c.StudentId, ct);
        db.Audit(user, "payment", name, $"{label} fee marked as {(c.Paid ? "paid" : "unpaid")}");
        var block = await db.AccessBlocks.FirstOrDefaultAsync(b => b.StudentId == c.StudentId && b.CourseId == c.CourseId, ct);
        if (c.Paid && block is not null && block.Reason.StartsWith(RegistrarRules.PaymentReason))
        {
            db.AccessBlocks.Remove(block);
            db.Audit(user, "unblock", name, $"Unblocked from course {label} (payment received)");
            db.Notifications.Add(new Notification { UserId = c.StudentId, Component = "System", Subject = "Access restored", Text = $"Your payment for {label} has been received and your access has been restored.", Link = $"/courses/{c.CourseId}" });
        }
        if (!c.Paid && block is null && (await db.SystemSettings.FirstOrDefaultAsync(s => s.Key == "AutoBlockUnpaid", ct))?.Value == "true")
        {
            db.AccessBlocks.Add(new AccessBlock { StudentId = c.StudentId, CourseId = c.CourseId, Reason = RegistrarRules.PaymentReason, BlockedBy = user.Name });
            db.Audit(user, "block", name, $"Blocked from course {label}: {RegistrarRules.PaymentReason}");
        }
        await db.SaveChangesAsync(ct);
    }
}

public record BlockAllUnpaidCommand : IRequest<int>;

public class BlockAllUnpaidHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<BlockAllUnpaidCommand, int>
{
    public async Task<int> Handle(BlockAllUnpaidCommand c, CancellationToken ct)
    {
        user.RequireAdmin();
        var unpaid = await db.Payments.Where(p => !p.Paid).ToListAsync(ct);
        var enrolled = await db.Enrolments.ToListAsync(ct);
        var blocks = await db.AccessBlocks.ToListAsync(ct);
        var n = 0;
        foreach (var p in unpaid.Where(p => enrolled.Any(e => e.CourseId == p.CourseId && e.UserId == p.StudentId) && !blocks.Any(b => b.StudentId == p.StudentId && b.CourseId == p.CourseId)))
        {
            db.AccessBlocks.Add(new AccessBlock { StudentId = p.StudentId, CourseId = p.CourseId, Reason = RegistrarRules.PaymentReason, BlockedBy = user.Name });
            db.Audit(user, "block", await db.UserNameAsync(p.StudentId, ct), $"Blocked from course {await db.CourseLabelAsync(p.CourseId, ct)}: {RegistrarRules.PaymentReason}");
            n++;
        }
        await db.SaveChangesAsync(ct);
        return n;
    }
}

public record SetAutoBlockCommand(bool Enabled) : IRequest;

public class SetAutoBlockHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<SetAutoBlockCommand>
{
    public async Task Handle(SetAutoBlockCommand c, CancellationToken ct)
    {
        user.RequireAdmin();
        var s = await db.SystemSettings.FirstOrDefaultAsync(x => x.Key == "AutoBlockUnpaid", ct);
        if (s is null) db.SystemSettings.Add(new SystemSetting { Key = "AutoBlockUnpaid", Value = c.Enabled ? "true" : "false" });
        else s.Value = c.Enabled ? "true" : "false";
        db.Audit(user, "settings", "Payments", $"Automatic blocking of unpaid students {(c.Enabled ? "enabled" : "disabled")}");
        await db.SaveChangesAsync(ct);
    }
}

// ── Enrolment & lecturers ────────────────────────────────────────────────────

public record EnrolStudentsCommand(int CourseId, string[] StudentIds, bool Remove) : IRequest;

public class EnrolStudentsHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<EnrolStudentsCommand>
{
    public async Task Handle(EnrolStudentsCommand c, CancellationToken ct)
    {
        user.RequireAdmin();
        var course = await db.Courses.FindAsync([c.CourseId], ct) ?? throw new NotFoundException("Course not found");
        var existing = await db.Enrolments.Where(e => e.CourseId == c.CourseId && c.StudentIds.Contains(e.UserId)).ToListAsync(ct);
        var names = new List<string>();
        foreach (var sid in c.StudentIds.Distinct()) names.Add(await db.UserNameAsync(sid, ct));
        if (c.Remove) db.Enrolments.RemoveRange(existing);
        else
            foreach (var sid in c.StudentIds.Distinct().Where(s => existing.All(e => e.UserId != s)))
            {
                db.Enrolments.Add(new Enrolment { CourseId = c.CourseId, UserId = sid });
                if (!await db.Payments.AnyAsync(p => p.CourseId == c.CourseId && p.StudentId == sid, ct))
                    db.Payments.Add(new Payment { CourseId = c.CourseId, StudentId = sid, Amount = 45000, DueDate = DateTime.UtcNow.AddDays(14) });
                db.Notifications.Add(new Notification { UserId = sid, Component = "System", Subject = $"You have been enrolled in {course.ShortName}", Text = $"The Assistant Registrar enrolled you in {course.ShortName}-{course.FullName}.", Link = $"/courses/{course.Id}" });
            }
        db.Audit(user, c.Remove ? "unenrol" : "enrol", $"{course.ShortName}-{course.FullName}", $"{(c.Remove ? "Removed" : "Enrolled")} {c.StudentIds.Length} student(s): {string.Join(", ", names)}");
        await db.SaveChangesAsync(ct);
    }
}

public record SetCourseLecturerCommand(int CourseId, string LecturerId) : IRequest;

public class SetCourseLecturerHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<SetCourseLecturerCommand>
{
    public async Task Handle(SetCourseLecturerCommand c, CancellationToken ct)
    {
        user.RequireAdmin();
        var course = await db.Courses.FindAsync([c.CourseId], ct) ?? throw new NotFoundException("Course not found");
        var name = await db.UserNameAsync(c.LecturerId, ct);
        course.LecturerId = c.LecturerId;
        course.LecturerName = name;
        db.Audit(user, "lecturer", $"{course.ShortName}-{course.FullName}", $"Lecturer set to {name}");
        await db.SaveChangesAsync(ct);
    }
}

// ── Submission override ──────────────────────────────────────────────────────

public record OverrideSubmissionCommand(int ActivityId, string StudentId, decimal? Grade, string Feedback, string Status, DateTime? ExtensionUntil) : IRequest;

public class OverrideSubmissionHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<OverrideSubmissionCommand>
{
    public async Task Handle(OverrideSubmissionCommand c, CancellationToken ct)
    {
        user.RequireAdmin();
        var a = await db.Activities.AsNoTracking().FirstOrDefaultAsync(x => x.Id == c.ActivityId && x.Type == "assign", ct) ?? throw new NotFoundException("Assignment not found");
        var maxGrade = System.Text.Json.JsonDocument.Parse(a.AssignJson ?? "{}").RootElement.TryGetProperty("maxGrade", out var mg) ? mg.GetDecimal() : 100;
        if (c.Grade is not null && (c.Grade < 0 || c.Grade > maxGrade)) throw new BusinessRuleException($"Grade must be between 0 and {maxGrade}.");
        if (c.Status is not ("new" or "draft" or "submitted")) throw new BusinessRuleException("Invalid status.");
        var name = await db.UserNameAsync(c.StudentId, ct);
        var sub = await db.Submissions.FirstOrDefaultAsync(s => s.ActivityId == c.ActivityId && s.StudentId == c.StudentId, ct);
        if (sub is null) { sub = new Submission { ActivityId = c.ActivityId, StudentId = c.StudentId }; db.Submissions.Add(sub); }

        if (sub.Grade != c.Grade || sub.Feedback != (c.Feedback ?? ""))
        {
            var ov = await db.GradeOverrides.FirstOrDefaultAsync(o => o.ActivityId == c.ActivityId && o.StudentId == c.StudentId, ct);
            var previous = sub.Grade?.ToString("0.##") ?? "Not graded";
            if (ov is null) db.GradeOverrides.Add(new GradeOverride { ActivityId = c.ActivityId, StudentId = c.StudentId, OverriddenBy = user.Name, Previous = previous });
            else { ov.OverriddenBy = user.Name; ov.At = DateTime.UtcNow; ov.Previous = previous; }
            db.Audit(user, "override", name, $"{a.Name}: grade changed from {previous} to {c.Grade?.ToString("0.##") ?? "-"}");
            sub.Grade = c.Grade; sub.Feedback = c.Feedback ?? ""; sub.GradedAt = DateTime.UtcNow;
        }
        if (sub.Status != c.Status)
        {
            db.Audit(user, "status", name, $"{a.Name}: status changed from {sub.Status} to {c.Status}");
            sub.Status = c.Status; sub.ModifiedAt = DateTime.UtcNow;
        }
        var ext = await db.SubmissionExtensions.FirstOrDefaultAsync(e => e.ActivityId == c.ActivityId && e.StudentId == c.StudentId, ct);
        if (c.ExtensionUntil != ext?.Until)
        {
            if (c.ExtensionUntil is null) { if (ext is not null) db.SubmissionExtensions.Remove(ext); db.Audit(user, "extension", name, $"{a.Name}: extension removed"); }
            else
            {
                if (ext is null) db.SubmissionExtensions.Add(new SubmissionExtension { ActivityId = c.ActivityId, StudentId = c.StudentId, Until = c.ExtensionUntil.Value });
                else ext.Until = c.ExtensionUntil.Value;
                db.Audit(user, "extension", name, $"{a.Name}: extension granted until {c.ExtensionUntil.Value.ToLocalTime():d MMM yyyy, h:mm tt}");
                db.Notifications.Add(new Notification { UserId = c.StudentId, Component = "Assignment", Subject = $"Extension granted: {a.Name}", Text = $"You can submit {a.Name} until {c.ExtensionUntil.Value.ToLocalTime():dddd, d MMMM yyyy, h:mm tt}.", Link = "/dashboard" });
            }
        }
        await db.SaveChangesAsync(ct);
    }
}
