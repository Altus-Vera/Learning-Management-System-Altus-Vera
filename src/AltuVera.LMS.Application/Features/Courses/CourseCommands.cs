using System.Text.Json;
using AltuVera.LMS.Application.Common;
using AltuVera.LMS.Application.Common.Exceptions;
using AltuVera.LMS.Application.Common.Interfaces;
using AltuVera.LMS.Domain.Entities.Academics;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.LMS.Application.Features.Courses;

// ── Course state (star / hide / last access) ────────────────────────────────

public record SetCourseStateCommand(int CourseId, bool? Starred, bool? Hidden, bool Touch) : IRequest;

public class SetCourseStateHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<SetCourseStateCommand>
{
    public async Task Handle(SetCourseStateCommand c, CancellationToken ct)
    {
        var st = await db.CourseUserStates.FirstOrDefaultAsync(s => s.CourseId == c.CourseId && s.UserId == user.UserId, ct);
        if (st is null) { st = new CourseUserState { CourseId = c.CourseId, UserId = user.UserId }; db.CourseUserStates.Add(st); }
        if (c.Starred is not null) st.Starred = c.Starred.Value;
        if (c.Hidden is not null) st.Hidden = c.Hidden.Value;
        if (c.Touch) st.LastAccess = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}

// ── Manual completion ───────────────────────────────────────────────────────

public record ToggleCompletionCommand(int ActivityId) : IRequest;

public class ToggleCompletionHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<ToggleCompletionCommand>
{
    public async Task Handle(ToggleCompletionCommand c, CancellationToken ct)
    {
        await db.EnsureStudentCanActAsync(user, c.ActivityId, ct);
        var row = await db.ActivityCompletions.FirstOrDefaultAsync(x => x.ActivityId == c.ActivityId && x.UserId == user.UserId, ct);
        if (row is null) db.ActivityCompletions.Add(new ActivityCompletion { ActivityId = c.ActivityId, UserId = user.UserId });
        else db.ActivityCompletions.Remove(row);
        await db.SaveChangesAsync(ct);
    }
}

// ── Activity editing (lecturer / registrar) ─────────────────────────────────

public record UpdateActivityCommand(int Id, string? Name, string? Description, string? Content, bool? Visible, JsonElement? Assign, JsonElement? Quiz) : IRequest;

public class UpdateActivityHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<UpdateActivityCommand>
{
    public async Task Handle(UpdateActivityCommand c, CancellationToken ct)
    {
        user.RequireTeacher();
        var a = await db.Activities.Include(x => x.Section).FirstOrDefaultAsync(x => x.Id == c.Id, ct) ?? throw new NotFoundException($"Activity {c.Id} not found");
        await EnsureTeachesAsync(db, user, a.Section!.CourseId, ct);
        var changes = new List<string>();
        if (c.Name is not null && c.Name != a.Name) { if (string.IsNullOrWhiteSpace(c.Name)) throw new BusinessRuleException("Name is required."); changes.Add($"renamed to “{c.Name}”"); a.Name = c.Name.Trim(); }
        if (c.Description is not null && c.Description != a.Description) { a.Description = c.Description; changes.Add("description updated"); }
        if (c.Content is not null && c.Content != a.Content) { a.Content = c.Content; changes.Add("content updated"); }
        if (c.Visible is not null && c.Visible != a.Visible) { a.Visible = c.Visible.Value; changes.Add(c.Visible.Value ? "shown to students" : "hidden from students"); }
        if (c.Assign is not null) { a.AssignJson = c.Assign.Value.GetRawText(); changes.Add("assignment settings updated"); }
        if (c.Quiz is not null) { a.QuizJson = c.Quiz.Value.GetRawText(); changes.Add("quiz settings updated"); }
        if (changes.Count == 0) return;
        db.Audit(user, c.Visible is not null && changes.Count == 1 ? "visibility" : "settings", a.Name, string.Join(", ", changes));
        await db.SaveChangesAsync(ct);
    }

    public static async Task EnsureTeachesAsync(IApplicationDbContext db, ICurrentUserService user, int courseId, CancellationToken ct)
    {
        if (user.IsAdmin) return;
        if (!await db.Courses.AnyAsync(x => x.Id == courseId && x.LecturerId == user.UserId, ct))
            throw new ForbiddenAccessException("You are not the lecturer of this course.");
    }
}

public record AddActivityCommand(int SectionId, string Type, string Name) : IRequest<int>;

public class AddActivityHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<AddActivityCommand, int>
{
    private static readonly string[] Types = ["assign", "resource", "forum", "quiz", "url", "folder", "choice", "feedback", "page", "label"];

    public async Task<int> Handle(AddActivityCommand c, CancellationToken ct)
    {
        user.RequireTeacher();
        if (!Types.Contains(c.Type)) throw new BusinessRuleException("Unknown activity type.");
        if (string.IsNullOrWhiteSpace(c.Name)) throw new BusinessRuleException("Name is required.");
        var section = await db.CourseSections.FirstOrDefaultAsync(s => s.Id == c.SectionId, ct) ?? throw new NotFoundException("Section not found");
        await UpdateActivityHandler.EnsureTeachesAsync(db, user, section.CourseId, ct);
        var order = await db.Activities.Where(a => a.SectionId == c.SectionId).Select(a => (int?)a.SortOrder).MaxAsync(ct) ?? -1;
        var now = DateTime.UtcNow;
        var a = new Activity
        {
            SectionId = c.SectionId, SortOrder = order + 1, Type = c.Type, Name = c.Name.Trim(), Visible = true, Description = "",
            Content = c.Type is "page" or "label" ? c.Name.Trim() : null,
            AssignJson = c.Type == "assign" ? JsonSerializer.Serialize(new { allowSubmissionsFrom = now, dueDate = now.AddDays(7), cutOffDate = now.AddDays(9), remindToGradeBy = now.AddDays(14), acceptingSubmissions = true, fileSubmissions = true, onlineText = false, maxFiles = 1, maxSizeMb = 20, acceptedTypes = ".pdf,.docx,.pptx,.zip", requireSubmitButton = true, maxGrade = 100 }) : null,
            QuizJson = c.Type == "quiz" ? JsonSerializer.Serialize(new { openDate = now, closeDate = now.AddDays(6), timeLimitMins = 30, attemptsAllowed = 1, gradingMethod = "Highest grade", maxGrade = 10, reviewAfterClose = true, questionCount = 10, category = "All", shuffleQuestions = true, shuffleAnswers = true }) : null,
        };
        db.Activities.Add(a);
        await db.SaveChangesAsync(ct);
        if (c.Type == "choice")
            foreach (var g in new[] { "Group A", "Group B", "Group C", "Group D" })
                db.ChoiceGroups.Add(new Domain.Entities.Assessment.ChoiceGroup { ActivityId = a.Id, Name = g, Capacity = 5 });
        db.Audit(user, "settings", await db.CourseLabelAsync(section.CourseId, ct), $"Added {c.Type} “{a.Name}” to {section.Title}");
        await db.SaveChangesAsync(ct);
        return a.Id;
    }
}

public record DeleteActivityCommand(int Id) : IRequest;

public class DeleteActivityHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<DeleteActivityCommand>
{
    public async Task Handle(DeleteActivityCommand c, CancellationToken ct)
    {
        user.RequireTeacher();
        var a = await db.Activities.Include(x => x.Section).FirstOrDefaultAsync(x => x.Id == c.Id, ct) ?? throw new NotFoundException($"Activity {c.Id} not found");
        await UpdateActivityHandler.EnsureTeachesAsync(db, user, a.Section!.CourseId, ct);
        db.Activities.Remove(a);
        db.Audit(user, "settings", a.Name, "Activity deleted");
        await db.SaveChangesAsync(ct);
    }
}

// ── Calendar ────────────────────────────────────────────────────────────────

public record AddEventCommand(string Title, DateTime Date, string Type, int? CourseId) : IRequest<int>;

public class AddEventHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<AddEventCommand, int>
{
    public async Task<int> Handle(AddEventCommand c, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(c.Title)) throw new BusinessRuleException("Event title is required.");
        if (c.Type is not ("user" or "course" or "site")) throw new BusinessRuleException("Invalid event type.");
        if (c.Type != "user") user.RequireTeacher();
        if (c.Type == "site") user.RequireAdmin();
        if (c.Type == "course" && c.CourseId is null) throw new BusinessRuleException("Select a course for a course event.");
        var e = new CalendarEvent { Title = c.Title.Trim(), Date = c.Date, Type = c.Type, CourseId = c.CourseId, UserId = c.Type == "user" ? user.UserId : null };
        db.CalendarEvents.Add(e);
        await db.SaveChangesAsync(ct);
        return e.Id;
    }
}

public record DeleteEventCommand(int Id) : IRequest;

public class DeleteEventHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<DeleteEventCommand>
{
    public async Task Handle(DeleteEventCommand c, CancellationToken ct)
    {
        var e = await db.CalendarEvents.FindAsync([c.Id], ct) ?? throw new NotFoundException("Event not found");
        if (e.Type == "user" ? e.UserId != user.UserId : !user.IsTeacher) throw new ForbiddenAccessException();
        db.CalendarEvents.Remove(e);
        await db.SaveChangesAsync(ct);
    }
}
