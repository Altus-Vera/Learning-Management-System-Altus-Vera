using System.Text.Json;
using AltuVera.LMS.Application.Common;
using AltuVera.LMS.Application.Common.Exceptions;
using AltuVera.LMS.Application.Common.Interfaces;
using AltuVera.LMS.Domain.Entities.Assessment;
using AltuVera.LMS.Domain.Entities.Forums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.LMS.Application.Features.Activities;

// ── Forums ───────────────────────────────────────────────────────────────────

internal static class ForumRules
{
    public static async Task<(bool News, int CourseId)> LoadForumAsync(IApplicationDbContext db, int activityId, CancellationToken ct)
    {
        var a = await db.Activities.AsNoTracking().Include(x => x.Section).FirstOrDefaultAsync(x => x.Id == activityId && x.Type == "forum", ct) ?? throw new NotFoundException("Forum not found");
        return (a.Name == "Announcements", a.Section!.CourseId);
    }
}

public record AddDiscussionCommand(int ForumId, string Subject, string Message, bool Pinned) : IRequest<int>;

public class AddDiscussionHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<AddDiscussionCommand, int>
{
    public async Task<int> Handle(AddDiscussionCommand c, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(c.Subject) || string.IsNullOrWhiteSpace(c.Message)) throw new BusinessRuleException("Subject and message are required.");
        await db.EnsureStudentCanActAsync(user, c.ForumId, ct);
        var (news, _) = await ForumRules.LoadForumAsync(db, c.ForumId, ct);
        if (news && !user.IsTeacher) throw new ForbiddenAccessException("Only lecturers can post announcements.");
        var d = new ForumDiscussion { ActivityId = c.ForumId, Subject = c.Subject.Trim(), AuthorId = user.UserId, AuthorName = user.Name, Pinned = c.Pinned && user.IsTeacher, Posts = [new ForumPost { AuthorId = user.UserId, AuthorName = user.Name, Message = c.Message.Trim() }] };
        db.ForumDiscussions.Add(d);
        await db.SaveChangesAsync(ct);
        return d.Id;
    }
}

public record ReplyCommand(int DiscussionId, int ParentId, string Message) : IRequest<int>;

public class ReplyHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<ReplyCommand, int>
{
    public async Task<int> Handle(ReplyCommand c, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(c.Message)) throw new BusinessRuleException("Message is required.");
        var d = await db.ForumDiscussions.FirstOrDefaultAsync(x => x.Id == c.DiscussionId, ct) ?? throw new NotFoundException("Discussion not found");
        await db.EnsureStudentCanActAsync(user, d.ActivityId, ct);
        var (news, _) = await ForumRules.LoadForumAsync(db, d.ActivityId, ct);
        if (d.Locked) throw new BusinessRuleException("This discussion has been locked so you can no longer reply to it.");
        if (news && !user.IsTeacher) throw new ForbiddenAccessException("You cannot reply to announcements.");
        var p = new ForumPost { DiscussionId = d.Id, ParentId = c.ParentId, AuthorId = user.UserId, AuthorName = user.Name, Message = c.Message.Trim() };
        db.ForumPosts.Add(p);
        await db.SaveChangesAsync(ct);
        return p.Id;
    }
}

public record EditPostCommand(int PostId, string Message) : IRequest;

public class EditPostHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<EditPostCommand>
{
    public async Task Handle(EditPostCommand c, CancellationToken ct)
    {
        var p = await db.ForumPosts.FindAsync([c.PostId], ct) ?? throw new NotFoundException("Post not found");
        if (p.AuthorId != user.UserId && !user.IsTeacher) throw new ForbiddenAccessException();
        if (string.IsNullOrWhiteSpace(c.Message)) throw new BusinessRuleException("Message is required.");
        p.Message = c.Message.Trim();
        await db.SaveChangesAsync(ct);
    }
}

public record DeletePostCommand(int PostId) : IRequest;

public class DeletePostHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<DeletePostCommand>
{
    public async Task Handle(DeletePostCommand c, CancellationToken ct)
    {
        var p = await db.ForumPosts.FindAsync([c.PostId], ct) ?? throw new NotFoundException("Post not found");
        if (p.AuthorId != user.UserId && !user.IsTeacher) throw new ForbiddenAccessException();
        if (p.ParentId is null) throw new BusinessRuleException("Delete the discussion instead of its first post.");
        var all = await db.ForumPosts.Where(x => x.DiscussionId == p.DiscussionId).ToListAsync(ct);
        var remove = new HashSet<int> { p.Id };
        bool added;
        do { added = false; foreach (var x in all.Where(x => x.ParentId is not null && remove.Contains(x.ParentId.Value) && !remove.Contains(x.Id))) { remove.Add(x.Id); added = true; } } while (added);
        db.ForumPosts.RemoveRange(all.Where(x => remove.Contains(x.Id)));
        await db.SaveChangesAsync(ct);
    }
}

public record SetDiscussionFlagsCommand(int DiscussionId, bool? Pinned, bool? Locked) : IRequest;

public class SetDiscussionFlagsHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<SetDiscussionFlagsCommand>
{
    public async Task Handle(SetDiscussionFlagsCommand c, CancellationToken ct)
    {
        user.RequireTeacher();
        var d = await db.ForumDiscussions.FindAsync([c.DiscussionId], ct) ?? throw new NotFoundException("Discussion not found");
        if (c.Pinned is not null) d.Pinned = c.Pinned.Value;
        if (c.Locked is not null) d.Locked = c.Locked.Value;
        db.Audit(user, "settings", d.Subject, $"Discussion {(c.Pinned is not null ? (c.Pinned.Value ? "pinned" : "unpinned") : (c.Locked!.Value ? "locked" : "unlocked"))}");
        await db.SaveChangesAsync(ct);
    }
}

public record DeleteDiscussionCommand(int DiscussionId) : IRequest;

public class DeleteDiscussionHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<DeleteDiscussionCommand>
{
    public async Task Handle(DeleteDiscussionCommand c, CancellationToken ct)
    {
        var d = await db.ForumDiscussions.FindAsync([c.DiscussionId], ct) ?? throw new NotFoundException("Discussion not found");
        if (d.AuthorId != user.UserId && !user.IsTeacher) throw new ForbiddenAccessException();
        db.ForumDiscussions.Remove(d);
        if (user.IsTeacher) db.Audit(user, "settings", d.Subject, "Discussion deleted");
        await db.SaveChangesAsync(ct);
    }
}

public record ToggleForumSubscriptionCommand(int ForumId) : IRequest;

public class ToggleForumSubscriptionHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<ToggleForumSubscriptionCommand>
{
    public async Task Handle(ToggleForumSubscriptionCommand c, CancellationToken ct)
    {
        var (news, _) = await ForumRules.LoadForumAsync(db, c.ForumId, ct);
        var s = await db.ForumSubscriptions.FirstOrDefaultAsync(x => x.ActivityId == c.ForumId && x.UserId == user.UserId, ct);
        if (s is null) db.ForumSubscriptions.Add(new ForumSubscription { ActivityId = c.ForumId, UserId = user.UserId, Subscribed = !news });
        else s.Subscribed = !s.Subscribed;
        await db.SaveChangesAsync(ct);
    }
}

public record ToggleDiscussionStarCommand(int DiscussionId) : IRequest;

public class ToggleDiscussionStarHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<ToggleDiscussionStarCommand>
{
    public async Task Handle(ToggleDiscussionStarCommand c, CancellationToken ct)
    {
        var s = await db.DiscussionStars.FirstOrDefaultAsync(x => x.DiscussionId == c.DiscussionId && x.UserId == user.UserId, ct);
        if (s is null) db.DiscussionStars.Add(new DiscussionStar { DiscussionId = c.DiscussionId, UserId = user.UserId });
        else db.DiscussionStars.Remove(s);
        await db.SaveChangesAsync(ct);
    }
}

// ── Quizzes ──────────────────────────────────────────────────────────────────

public record QuizSettings(DateTime? OpenDate, DateTime? CloseDate, int TimeLimitMins, int AttemptsAllowed, string GradingMethod, decimal MaxGrade, bool ReviewAfterClose);

internal static class QuizRules
{
    public static readonly int[] AnswerKey = [1, 0, 1, 2, 1];
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<QuizSettings> LoadAsync(IApplicationDbContext db, int activityId, CancellationToken ct)
    {
        var json = await db.Activities.AsNoTracking().Where(a => a.Id == activityId && a.Type == "quiz").Select(a => a.QuizJson).FirstOrDefaultAsync(ct) ?? throw new NotFoundException("Quiz not found");
        return JsonSerializer.Deserialize<QuizSettings>(json, Json)!;
    }
}

public record StartQuizAttemptCommand(int QuizId) : IRequest<object>;

public class StartQuizAttemptHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<StartQuizAttemptCommand, object>
{
    public async Task<object> Handle(StartQuizAttemptCommand c, CancellationToken ct)
    {
        await db.EnsureStudentCanActAsync(user, c.QuizId, ct);
        var s = await QuizRules.LoadAsync(db, c.QuizId, ct);
        var now = DateTime.UtcNow;
        if (s.OpenDate is not null && now < s.OpenDate) throw new BusinessRuleException("This quiz is not open yet.");
        if (s.CloseDate is not null && now > s.CloseDate) throw new BusinessRuleException("This quiz has closed.");
        var used = await db.QuizAttempts.CountAsync(a => a.ActivityId == c.QuizId && a.UserId == user.UserId && a.FinishedAt != null, ct);
        if (s.AttemptsAllowed > 0 && used >= s.AttemptsAllowed) throw new BusinessRuleException("No more attempts are allowed.");
        var open = await db.QuizAttempts.FirstOrDefaultAsync(a => a.ActivityId == c.QuizId && a.UserId == user.UserId && a.FinishedAt == null, ct);
        if (open is null) { open = new QuizAttempt { ActivityId = c.QuizId, UserId = user.UserId }; db.QuizAttempts.Add(open); await db.SaveChangesAsync(ct); }
        return new { id = open.Id, userId = open.UserId, startedAt = open.StartedAt, finishedAt = (DateTime?)null, answers = new Dictionary<string, int>(), score = (int?)null };
    }
}

public record FinishQuizAttemptCommand(int AttemptId, Dictionary<string, int> Answers) : IRequest<int>;

public class FinishQuizAttemptHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<FinishQuizAttemptCommand, int>
{
    public async Task<int> Handle(FinishQuizAttemptCommand c, CancellationToken ct)
    {
        var a = await db.QuizAttempts.FindAsync([c.AttemptId], ct) ?? throw new NotFoundException("Attempt not found");
        if (a.UserId != user.UserId) throw new ForbiddenAccessException();
        if (a.FinishedAt is not null) return a.Score ?? 0;
        var s = await QuizRules.LoadAsync(db, a.ActivityId, ct);
        var answers = c.Answers.Where(kv => int.TryParse(kv.Key, out var i) && i >= 0 && i < QuizRules.AnswerKey.Length).ToDictionary(kv => kv.Key, kv => kv.Value);
        var deadline = a.StartedAt.AddMinutes(s.TimeLimitMins + 1);
        a.FinishedAt = DateTime.UtcNow > deadline ? deadline : DateTime.UtcNow;
        a.AnswersJson = JsonSerializer.Serialize(answers);
        a.Score = answers.Count(kv => QuizRules.AnswerKey[int.Parse(kv.Key)] == kv.Value);
        await db.SaveChangesAsync(ct);
        return a.Score.Value;
    }
}

// ── Feedback ─────────────────────────────────────────────────────────────────

public record SubmitFeedbackCommand(int FeedbackId, JsonElement Answers) : IRequest;

public class SubmitFeedbackHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<SubmitFeedbackCommand>
{
    public async Task Handle(SubmitFeedbackCommand c, CancellationToken ct)
    {
        await db.EnsureStudentCanActAsync(user, c.FeedbackId, ct);
        if (!await db.Activities.AnyAsync(a => a.Id == c.FeedbackId && a.Type == "feedback", ct)) throw new NotFoundException("Feedback not found");
        if (await db.FeedbackResponses.AnyAsync(f => f.ActivityId == c.FeedbackId && f.UserId == user.UserId, ct)) throw new BusinessRuleException("You've already completed this activity.");
        foreach (var q in new[] { "q1", "q2", "q3", "q4", "q5" })
            if (!c.Answers.TryGetProperty(q, out var v) || v.ValueKind != JsonValueKind.Number || v.GetInt32() is < 1 or > 5)
                throw new BusinessRuleException("There are required fields in this form that must be completed.");
        db.FeedbackResponses.Add(new FeedbackResponse { ActivityId = c.FeedbackId, UserId = user.UserId, AnswersJson = c.Answers.GetRawText() });
        await db.SaveChangesAsync(ct);
    }
}

// ── Group choice ─────────────────────────────────────────────────────────────

public record JoinChoiceGroupCommand(int ChoiceId, int? GroupId) : IRequest;

public class JoinChoiceGroupHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<JoinChoiceGroupCommand>
{
    public async Task Handle(JoinChoiceGroupCommand c, CancellationToken ct)
    {
        if (user.IsTeacher) throw new BusinessRuleException("Lecturers cannot join groups.");
        await db.EnsureStudentCanActAsync(user, c.ChoiceId, ct);
        var groups = await db.ChoiceGroups.Include(g => g.Members).Where(g => g.ActivityId == c.ChoiceId).ToListAsync(ct);
        var current = groups.SelectMany(g => g.Members).FirstOrDefault(m => m.UserId == user.UserId);
        if (c.GroupId is not null)
        {
            var target = groups.FirstOrDefault(g => g.Id == c.GroupId) ?? throw new NotFoundException("Group not found");
            if (current?.GroupId == target.Id) return;
            if (target.Members.Count >= target.Capacity) throw new BusinessRuleException($"{target.Name} is full.");
            target.Members.Add(new ChoiceGroupMember { UserId = user.UserId, MemberName = user.Name });
        }
        if (current is not null) db.ChoiceGroupMembers.Remove(current);
        await db.SaveChangesAsync(ct);
    }
}
