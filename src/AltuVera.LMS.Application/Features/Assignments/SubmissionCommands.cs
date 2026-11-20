using System.Text.Json;
using AltuVera.LMS.Application.Common;
using AltuVera.LMS.Application.Common.Exceptions;
using AltuVera.LMS.Application.Common.Interfaces;
using AltuVera.LMS.Application.Features.Courses;
using AltuVera.LMS.Domain.Entities.Academics;
using AltuVera.LMS.Domain.Entities.Assessment;
using AltuVera.LMS.Domain.Entities.Messaging;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.LMS.Application.Features.Assignments;

public record AssignSettings(DateTime? AllowSubmissionsFrom, DateTime? DueDate, DateTime? CutOffDate, DateTime? RemindToGradeBy, bool AcceptingSubmissions, bool FileSubmissions, bool OnlineText, int MaxFiles, int MaxSizeMb, string AcceptedTypes, bool RequireSubmitButton, decimal MaxGrade);

internal static class AssignRules
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<(Activity Activity, AssignSettings Settings)> LoadAsync(IApplicationDbContext db, int activityId, CancellationToken ct)
    {
        var a = await db.Activities.Include(x => x.Section).FirstOrDefaultAsync(x => x.Id == activityId && x.Type == "assign", ct) ?? throw new NotFoundException("Assignment not found");
        var s = JsonSerializer.Deserialize<AssignSettings>(a.AssignJson ?? "{}", Json) ?? throw new BusinessRuleException("Assignment is not configured.");
        return (a, s);
    }

    public static async Task EnsureAcceptingAsync(IApplicationDbContext db, Activity a, AssignSettings s, string studentId, CancellationToken ct)
    {
        if (!a.Visible) throw new ForbiddenAccessException("This assignment is not available.");
        var now = DateTime.UtcNow;
        var ext = await db.SubmissionExtensions.AsNoTracking().Where(e => e.ActivityId == a.Id && e.StudentId == studentId).Select(e => (DateTime?)e.Until).FirstOrDefaultAsync(ct);
        if (!s.AcceptingSubmissions) throw new BusinessRuleException("Submissions for this assignment have been disabled by the lecturer.");
        if (ext is not null && now <= ext) return;
        if (s.AllowSubmissionsFrom is not null && now < s.AllowSubmissionsFrom) throw new BusinessRuleException($"This assignment will accept submissions from {s.AllowSubmissionsFrom:dddd, d MMMM yyyy, h:mm tt}.");
        if (s.CutOffDate is not null && now > s.CutOffDate) throw new BusinessRuleException("This assignment is not accepting submissions. The cut-off date has passed.");
    }

    public static async Task<Submission> GetOrCreateAsync(IApplicationDbContext db, int activityId, string studentId, CancellationToken ct)
    {
        var sub = await db.Submissions.Include(x => x.Files).FirstOrDefaultAsync(x => x.ActivityId == activityId && x.StudentId == studentId, ct);
        if (sub is not null) return sub;
        sub = new Submission { ActivityId = activityId, StudentId = studentId, Status = "new" };
        db.Submissions.Add(sub);
        return sub;
    }

    public static void Notify(IApplicationDbContext db, string userId, string component, string subject, string text, string link) =>
        db.Notifications.Add(new Notification { UserId = userId, Component = component, Subject = subject, Text = text, Link = link });
}

// ── Student: files ───────────────────────────────────────────────────────────

public record UploadSubmissionFileCommand(int ActivityId, string FileName, long Size, Stream Content) : IRequest<object>;

public class UploadSubmissionFileHandler(IApplicationDbContext db, ICurrentUserService user, IFileStorage storage) : IRequestHandler<UploadSubmissionFileCommand, object>
{
    public async Task<object> Handle(UploadSubmissionFileCommand c, CancellationToken ct)
    {
        await db.EnsureStudentCanActAsync(user, c.ActivityId, ct);
        var (a, s) = await AssignRules.LoadAsync(db, c.ActivityId, ct);
        await AssignRules.EnsureAcceptingAsync(db, a, s, user.UserId, ct);
        if (!s.FileSubmissions) throw new BusinessRuleException("File submissions are not enabled for this assignment.");
        var ext = Path.GetExtension(c.FileName).ToLowerInvariant();
        var accepted = s.AcceptedTypes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(t => t.ToLowerInvariant()).ToArray();
        if (accepted.Length > 0 && !accepted.Contains(ext)) throw new BusinessRuleException($"{c.FileName}: File type {ext} is not accepted. Accepted file types: {s.AcceptedTypes}");
        if (c.Size > s.MaxSizeMb * 1024L * 1024L) throw new BusinessRuleException($"{c.FileName} is too large. The maximum size is {s.MaxSizeMb} MB.");
        var sub = await AssignRules.GetOrCreateAsync(db, c.ActivityId, user.UserId, ct);
        if (sub.Status == "submitted" && (s.RequireSubmitButton || sub.Grade is not null)) throw new BusinessRuleException("This submission has already been submitted for grading.");
        if (sub.Files.Count >= s.MaxFiles) throw new BusinessRuleException($"You can attach a maximum of {s.MaxFiles} file(s) to this submission.");
        var stored = await storage.SaveAsync(c.Content, c.FileName, ct);
        var file = new SubmissionFile { FileName = Path.GetFileName(c.FileName), StoredName = stored, Size = c.Size };
        sub.Files.Add(file);
        if (sub.Status == "new") sub.Status = "draft";
        sub.ModifiedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return new { id = file.Id, name = file.FileName, size = file.Size, uploadedAt = file.UploadedAt, downloadable = true };
    }
}

public record DeleteSubmissionFileCommand(int FileId) : IRequest;

public class DeleteSubmissionFileHandler(IApplicationDbContext db, ICurrentUserService user, IFileStorage storage) : IRequestHandler<DeleteSubmissionFileCommand>
{
    public async Task Handle(DeleteSubmissionFileCommand c, CancellationToken ct)
    {
        var file = await db.SubmissionFiles.FindAsync([c.FileId], ct) ?? throw new NotFoundException("File not found");
        var sub = await db.Submissions.Include(x => x.Files).FirstAsync(x => x.Id == file.SubmissionId, ct);
        if (sub.StudentId != user.UserId) throw new ForbiddenAccessException();
        var (a, s) = await AssignRules.LoadAsync(db, sub.ActivityId, ct);
        await AssignRules.EnsureAcceptingAsync(db, a, s, user.UserId, ct);
        if (sub.Status == "submitted" && (s.RequireSubmitButton || sub.Grade is not null)) throw new BusinessRuleException("This submission has already been submitted for grading.");
        storage.Delete(file.StoredName);
        db.SubmissionFiles.Remove(file);
        sub.ModifiedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}

// ── Student: save / submit / remove ─────────────────────────────────────────

public record SaveSubmissionCommand(int ActivityId, string? OnlineText) : IRequest;

public class SaveSubmissionHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<SaveSubmissionCommand>
{
    public async Task Handle(SaveSubmissionCommand c, CancellationToken ct)
    {
        await db.EnsureStudentCanActAsync(user, c.ActivityId, ct);
        var (a, s) = await AssignRules.LoadAsync(db, c.ActivityId, ct);
        await AssignRules.EnsureAcceptingAsync(db, a, s, user.UserId, ct);
        var sub = await AssignRules.GetOrCreateAsync(db, c.ActivityId, user.UserId, ct);
        if (sub.Status == "submitted" && (s.RequireSubmitButton || sub.Grade is not null)) throw new BusinessRuleException("This submission has already been submitted for grading.");
        if (s.OnlineText) sub.OnlineText = c.OnlineText ?? "";
        if (s.FileSubmissions && !s.OnlineText && sub.Files.Count == 0) throw new BusinessRuleException("Nothing was submitted. You must add at least one file.");
        if (s.OnlineText && !s.FileSubmissions && string.IsNullOrWhiteSpace(sub.OnlineText)) throw new BusinessRuleException("Online text is required.");
        sub.Status = s.RequireSubmitButton ? "draft" : "submitted";
        sub.ModifiedAt = DateTime.UtcNow;
        if (sub.Status == "submitted") AssignRules.Notify(db, user.UserId, "Assignment", "Submission received", $"You have submitted {a.Name}.", $"/courses/{a.Section!.CourseId}/assign/{a.Id}");
        await db.SaveChangesAsync(ct);
    }
}

public record SubmitForGradingCommand(int ActivityId, bool StatementAccepted) : IRequest;

public class SubmitForGradingHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<SubmitForGradingCommand>
{
    public async Task Handle(SubmitForGradingCommand c, CancellationToken ct)
    {
        if (!c.StatementAccepted) throw new BusinessRuleException("You must agree to the submission statement.");
        await db.EnsureStudentCanActAsync(user, c.ActivityId, ct);
        var (a, s) = await AssignRules.LoadAsync(db, c.ActivityId, ct);
        await AssignRules.EnsureAcceptingAsync(db, a, s, user.UserId, ct);
        var sub = await db.Submissions.Include(x => x.Files).FirstOrDefaultAsync(x => x.ActivityId == c.ActivityId && x.StudentId == user.UserId, ct) ?? throw new BusinessRuleException("Nothing was submitted.");
        if (sub.Status != "draft") throw new BusinessRuleException("Only draft submissions can be submitted.");
        sub.Status = "submitted";
        sub.ModifiedAt = DateTime.UtcNow;
        AssignRules.Notify(db, user.UserId, "Assignment", "Submission received", $"You have submitted {a.Name} for grading.", $"/courses/{a.Section!.CourseId}/assign/{a.Id}");
        await db.SaveChangesAsync(ct);
    }
}

public record RemoveSubmissionCommand(int ActivityId) : IRequest;

public class RemoveSubmissionHandler(IApplicationDbContext db, ICurrentUserService user, IFileStorage storage) : IRequestHandler<RemoveSubmissionCommand>
{
    public async Task Handle(RemoveSubmissionCommand c, CancellationToken ct)
    {
        await db.EnsureStudentCanActAsync(user, c.ActivityId, ct);
        var (a, s) = await AssignRules.LoadAsync(db, c.ActivityId, ct);
        await AssignRules.EnsureAcceptingAsync(db, a, s, user.UserId, ct);
        var sub = await db.Submissions.Include(x => x.Files).FirstOrDefaultAsync(x => x.ActivityId == c.ActivityId && x.StudentId == user.UserId, ct);
        if (sub is null) return;
        if (sub.Grade is not null) throw new BusinessRuleException("A graded submission cannot be removed.");
        foreach (var f in sub.Files) storage.Delete(f.StoredName);
        db.SubmissionFiles.RemoveRange(sub.Files);
        sub.Status = "new";
        sub.OnlineText = "";
        sub.ModifiedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}

// ── Lecturer: grading ────────────────────────────────────────────────────────

public record GradeSubmissionCommand(int ActivityId, string StudentId, decimal? Grade, string Feedback) : IRequest;

public class GradeSubmissionHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<GradeSubmissionCommand>
{
    public async Task Handle(GradeSubmissionCommand c, CancellationToken ct)
    {
        user.RequireTeacher();
        var (a, s) = await AssignRules.LoadAsync(db, c.ActivityId, ct);
        await UpdateActivityHandler.EnsureTeachesAsync(db, user, a.Section!.CourseId, ct);
        if (c.Grade is not null && (c.Grade < 0 || c.Grade > s.MaxGrade)) throw new BusinessRuleException($"Grade must be between 0 and {s.MaxGrade}.");
        var sub = await AssignRules.GetOrCreateAsync(db, c.ActivityId, c.StudentId, ct);
        if (sub.Grade == c.Grade && sub.Feedback == (c.Feedback ?? "")) return;
        sub.Grade = c.Grade;
        sub.Feedback = c.Feedback ?? "";
        sub.GradedAt = DateTime.UtcNow;
        var name = await db.UserNameAsync(c.StudentId, ct);
        db.Audit(user, "grade", name, $"{a.Name}: graded {c.Grade?.ToString("0.##") ?? "-"}/{s.MaxGrade:0.##}");
        if (c.Grade is not null) AssignRules.Notify(db, c.StudentId, "Assignment", $"{a.Name} has been graded", $"Your submission for {a.Name} has been graded. View the feedback in the assignment.", $"/courses/{a.Section.CourseId}/assign/{a.Id}");
        await db.SaveChangesAsync(ct);
    }
}

public record SetSubmissionStatusCommand(int ActivityId, string StudentId, string Status) : IRequest;

public class SetSubmissionStatusHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<SetSubmissionStatusCommand>
{
    public async Task Handle(SetSubmissionStatusCommand c, CancellationToken ct)
    {
        user.RequireTeacher();
        if (c.Status is not ("new" or "draft" or "submitted")) throw new BusinessRuleException("Invalid status.");
        var (a, _) = await AssignRules.LoadAsync(db, c.ActivityId, ct);
        await UpdateActivityHandler.EnsureTeachesAsync(db, user, a.Section!.CourseId, ct);
        var sub = await AssignRules.GetOrCreateAsync(db, c.ActivityId, c.StudentId, ct);
        if (sub.Status == c.Status) return;
        db.Audit(user, "status", await db.UserNameAsync(c.StudentId, ct), $"{a.Name}: status changed from {sub.Status} to {c.Status}");
        sub.Status = c.Status;
        sub.ModifiedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}

// ── Comments ─────────────────────────────────────────────────────────────────

public record AddSubmissionCommentCommand(int ActivityId, string StudentId, string Text) : IRequest<int>;

public class AddSubmissionCommentHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<AddSubmissionCommentCommand, int>
{
    public async Task<int> Handle(AddSubmissionCommentCommand c, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(c.Text)) throw new BusinessRuleException("Comment cannot be empty.");
        if (!user.IsTeacher && c.StudentId != user.UserId) throw new ForbiddenAccessException();
        await db.EnsureStudentCanActAsync(user, c.ActivityId, ct);
        var comment = new SubmissionComment { ActivityId = c.ActivityId, StudentId = c.StudentId, AuthorId = user.UserId, AuthorName = user.Name, Text = c.Text.Trim() };
        db.SubmissionComments.Add(comment);
        if (user.IsTeacher) AssignRules.Notify(db, c.StudentId, "Assignment", "New submission comment", $"{user.Name} commented on your submission.", "/notifications");
        await db.SaveChangesAsync(ct);
        return comment.Id;
    }
}

public record DeleteSubmissionCommentCommand(int Id) : IRequest;

public class DeleteSubmissionCommentHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<DeleteSubmissionCommentCommand>
{
    public async Task Handle(DeleteSubmissionCommentCommand c, CancellationToken ct)
    {
        var comment = await db.SubmissionComments.FindAsync([c.Id], ct) ?? throw new NotFoundException("Comment not found");
        if (comment.AuthorId != user.UserId && !user.IsTeacher) throw new ForbiddenAccessException();
        db.SubmissionComments.Remove(comment);
        await db.SaveChangesAsync(ct);
    }
}

// ── File download ────────────────────────────────────────────────────────────

public record DownloadSubmissionFileQuery(int FileId) : IRequest<(Stream Stream, string FileName)>;

public class DownloadSubmissionFileHandler(IApplicationDbContext db, ICurrentUserService user, IFileStorage storage) : IRequestHandler<DownloadSubmissionFileQuery, (Stream, string)>
{
    public async Task<(Stream, string)> Handle(DownloadSubmissionFileQuery q, CancellationToken ct)
    {
        var file = await db.SubmissionFiles.AsNoTracking().FirstOrDefaultAsync(f => f.Id == q.FileId, ct) ?? throw new NotFoundException("File not found");
        var sub = await db.Submissions.AsNoTracking().FirstAsync(s => s.Id == file.SubmissionId, ct);
        if (sub.StudentId != user.UserId)
        {
            user.RequireTeacher();
            await UpdateActivityHandler.EnsureTeachesAsync(db, user, await db.CourseIdOfActivityAsync(sub.ActivityId, ct), ct);
        }
        var stream = storage.Open(file.StoredName) ?? throw new NotFoundException("This sample file has no stored content.");
        return (stream, file.FileName);
    }
}
