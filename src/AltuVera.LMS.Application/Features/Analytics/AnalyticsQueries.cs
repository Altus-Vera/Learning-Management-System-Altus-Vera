using System.Text.Json;
using AltuVera.LMS.Application.Common;
using AltuVera.LMS.Application.Common.Exceptions;
using AltuVera.LMS.Application.Common.Interfaces;
using AltuVera.LMS.Application.Features.Assignments;
using AltuVera.LMS.Application.Features.Activities;
using AltuVera.LMS.Domain.Entities.Messaging;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.LMS.Application.Features.Analytics;

public record StudentRisk(
    string StudentId, string Name, string? IndexNo, int CourseId, string CourseName,
    int RiskScore, string Level, decimal? AvgGrade, int Graded, int Missing, int Late, int Submitted, int DueSoFar,
    decimal? QuizAvg, int Completion, int? DaysSinceAccess, bool Blocked, bool PaymentDue,
    List<string> Reasons, List<string> Actions, List<decimal> GradeTrend);

internal static class RiskEngine
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<List<StudentRisk>> ComputeAsync(IApplicationDbContext db, IEnumerable<int> courseIds, string? onlyStudent, CancellationToken ct)
    {
        var ids = courseIds.ToList();
        var now = DateTime.UtcNow;
        var courses = await db.Courses.AsNoTracking().Include(c => c.Sections).ThenInclude(s => s.Activities).AsSplitQuery().Where(c => ids.Contains(c.Id)).ToListAsync(ct);
        var enrolments = await db.Enrolments.AsNoTracking().Where(e => ids.Contains(e.CourseId) && (onlyStudent == null || e.UserId == onlyStudent)).ToListAsync(ct);
        var studentIds = enrolments.Select(e => e.UserId).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(u => studentIds.Contains(u.Id)).Select(u => new { u.Id, u.FirstName, u.LastName, u.IndexNo }).ToListAsync(ct);
        var activityIds = courses.SelectMany(c => c.Sections.SelectMany(s => s.Activities.Select(a => a.Id))).ToList();
        var subs = await db.Submissions.AsNoTracking().Where(s => activityIds.Contains(s.ActivityId) && studentIds.Contains(s.StudentId)).ToListAsync(ct);
        var attempts = await db.QuizAttempts.AsNoTracking().Where(a => activityIds.Contains(a.ActivityId) && studentIds.Contains(a.UserId) && a.FinishedAt != null).ToListAsync(ct);
        var completions = await db.ActivityCompletions.AsNoTracking().Where(c => activityIds.Contains(c.ActivityId) && studentIds.Contains(c.UserId)).ToListAsync(ct);
        var states = await db.CourseUserStates.AsNoTracking().Where(s => ids.Contains(s.CourseId) && studentIds.Contains(s.UserId)).ToListAsync(ct);
        var extensions = await db.SubmissionExtensions.AsNoTracking().Where(e => activityIds.Contains(e.ActivityId) && studentIds.Contains(e.StudentId)).ToListAsync(ct);
        var blocks = await db.AccessBlocks.AsNoTracking().Where(b => studentIds.Contains(b.StudentId)).ToListAsync(ct);
        var payments = await db.Payments.AsNoTracking().Where(p => ids.Contains(p.CourseId) && studentIds.Contains(p.StudentId) && !p.Paid && p.DueDate < now).ToListAsync(ct);

        var result = new List<StudentRisk>();
        foreach (var c in courses)
        {
            var visible = c.Sections.SelectMany(s => s.Activities).Where(a => a.Visible).ToList();
            var assigns = visible.Where(a => a.Type == "assign" && a.AssignJson != null)
                .Select(a => (a, s: JsonSerializer.Deserialize<AssignSettings>(a.AssignJson!, Json)!)).ToList();
            var quizzes = visible.Where(a => a.Type == "quiz" && a.QuizJson != null)
                .Select(a => (a, s: JsonSerializer.Deserialize<QuizSettings>(a.QuizJson!, Json)!)).ToList();
            var trackable = visible.Where(a => a.Type != "label").ToList();

            foreach (var e in enrolments.Where(x => x.CourseId == c.Id))
            {
                var sid = e.UserId;
                var u = users.FirstOrDefault(x => x.Id == sid);
                var mySubs = subs.Where(s => s.StudentId == sid).ToList();
                var reasons = new List<string>(); var actions = new List<string>(); var score = 0;

                var graded = assigns.Select(x => (x, sub: mySubs.FirstOrDefault(s => s.ActivityId == x.a.Id)))
                    .Where(t => t.sub?.Grade != null && t.x.s.MaxGrade > 0)
                    .OrderBy(t => t.x.s.DueDate).Select(t => Math.Round(t.sub!.Grade!.Value / t.x.s.MaxGrade * 100, 1)).ToList();
                decimal? avg = graded.Count > 0 ? Math.Round(graded.Average(), 1) : null;

                var due = assigns.Where(x => x.s.DueDate != null && x.s.DueDate < now).ToList();
                var missing = due.Count(x =>
                {
                    var sub = mySubs.FirstOrDefault(s => s.ActivityId == x.a.Id);
                    if (sub?.Status == "submitted") return false;
                    var ext = extensions.FirstOrDefault(v => v.ActivityId == x.a.Id && v.StudentId == sid);
                    return ext is null || ext.Until < now;
                });
                var late = mySubs.Count(s => s.Status == "submitted" && s.ModifiedAt != null && assigns.Any(x => x.a.Id == s.ActivityId && x.s.DueDate != null && s.ModifiedAt > x.s.DueDate));
                var submitted = mySubs.Count(s => s.Status == "submitted");

                var quizScores = quizzes.Select(q => attempts.Where(t => t.ActivityId == q.a.Id && t.UserId == sid && t.Score != null).Select(t => (decimal)t.Score!.Value / QuizRulesPublic.Questions * 100).DefaultIfEmpty(-1).Max()).Where(v => v >= 0).ToList();
                var missedQuizzes = quizzes.Count(q => q.s.CloseDate != null && q.s.CloseDate < now && !attempts.Any(t => t.ActivityId == q.a.Id && t.UserId == sid));
                decimal? quizAvg = quizScores.Count > 0 ? Math.Round(quizScores.Average(), 1) : null;

                var done = trackable.Count(a => a.Type == "assign" ? mySubs.Any(s => s.ActivityId == a.Id && s.Status == "submitted") : completions.Any(x => x.ActivityId == a.Id && x.UserId == sid));
                var completion = trackable.Count == 0 ? 0 : (int)Math.Round(done * 100.0 / trackable.Count);

                var st = states.FirstOrDefault(s => s.CourseId == c.Id && s.UserId == sid);
                int? days = st is null ? null : (int)(now - st.LastAccess).TotalDays;

                if (avg is not null && avg < 50) { score += (int)Math.Min(35, (50 - avg.Value) * 0.7m + 10); reasons.Add($"Average grade is {avg:0.#}% (below the 50% pass mark)"); actions.Add("Schedule a one-to-one session to review weak areas"); }
                else if (avg is not null && avg < 60) { score += 10; reasons.Add($"Average grade is {avg:0.#}%, close to the pass mark"); }
                if (missing > 0) { score += Math.Min(30, missing * 8); reasons.Add($"{missing} assignment{(missing > 1 ? "s" : "")} past due and not submitted"); actions.Add("Remind the student about missing work or consider an extension"); }
                if (late > 0) { score += Math.Min(10, late * 3); reasons.Add($"{late} late submission{(late > 1 ? "s" : "")}"); }
                if (quizAvg is not null && quizAvg < 50) { score += 15; reasons.Add($"Quiz average is {quizAvg:0.#}%"); actions.Add("Share revision material and practice quizzes"); }
                if (missedQuizzes > 0) { score += Math.Min(10, missedQuizzes * 5); reasons.Add($"Missed {missedQuizzes} quiz{(missedQuizzes > 1 ? "zes" : "")}"); }
                if (days is null) { score += 10; reasons.Add("Has never opened the course"); actions.Add("Contact the student to check they can access the course"); }
                else if (days > 14) { score += 10; reasons.Add($"No course activity for {days} days"); actions.Add("Check in with the student about their engagement"); }
                if (completion < 30 && trackable.Count > 0) { score += 5; reasons.Add($"Only {completion}% of course activities completed"); }
                if (graded.Count >= 3 && graded.TakeLast(2).Average() < graded.SkipLast(2).Average() - 10) { score += 5; reasons.Add("Grades are declining in recent assignments"); actions.Add("Discuss recent difficulties with the student"); }
                var blocked = blocks.Any(b => b.StudentId == sid && (b.CourseId == null || b.CourseId == c.Id));
                var payDue = payments.Any(p => p.StudentId == sid && p.CourseId == c.Id);
                if (blocked) reasons.Add("Access is currently blocked by the Assistant Registrar");
                if (payDue) { reasons.Add("Coursework fee payment is overdue"); actions.Add("Refer to the registrar's office about the outstanding payment"); }

                score = Math.Min(100, score);
                var level = score >= 60 ? "High" : score >= 35 ? "Medium" : "Low";
                if (reasons.Count == 0) reasons.Add("On track — no concerns detected");
                result.Add(new StudentRisk(sid, u is null ? sid : $"{u.FirstName} {u.LastName}".Trim(), u?.IndexNo, c.Id, $"{c.ShortName}-{c.FullName}",
                    score, level, avg, graded.Count, missing, late, submitted, due.Count, quizAvg, completion, days, blocked, payDue, reasons, actions.Distinct().ToList(), graded));
            }
        }
        return result.OrderByDescending(r => r.RiskScore).ThenBy(r => r.Name).ToList();
    }
}

internal static class QuizRulesPublic { public const int Questions = 5; }

public record AtRiskQuery(int? CourseId) : IRequest<object>;

public class AtRiskHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<AtRiskQuery, object>
{
    public async Task<object> Handle(AtRiskQuery q, CancellationToken ct)
    {
        user.RequireTeacher();
        var courseQuery = db.Courses.AsNoTracking();
        if (!user.IsAdmin) courseQuery = courseQuery.Where(c => c.LecturerId == user.UserId);
        var courses = await courseQuery.Select(c => new { id = c.Id, name = c.ShortName + "-" + c.FullName }).ToListAsync(ct);
        var ids = courses.Select(c => c.id).Where(id => q.CourseId == null || id == q.CourseId).ToList();
        var students = await RiskEngine.ComputeAsync(db, ids, null, ct);
        var distribution = students.Where(s => s.AvgGrade != null).GroupBy(s => s.AvgGrade switch { < 40 => "0–39", < 50 => "40–49", < 60 => "50–59", < 70 => "60–69", < 80 => "70–79", _ => "80–100" })
            .ToDictionary(g => g.Key, g => g.Count());
        return new
        {
            courses,
            students,
            summary = new
            {
                high = students.Count(s => s.Level == "High"), medium = students.Count(s => s.Level == "Medium"), low = students.Count(s => s.Level == "Low"),
                avgGrade = students.Where(s => s.AvgGrade != null).Select(s => s.AvgGrade!.Value).DefaultIfEmpty().Average(),
                missing = students.Sum(s => s.Missing),
                topReasons = students.Where(s => s.Level != "Low").SelectMany(s => s.Reasons).Select(r => r.Split(' ').Length > 3 ? ReasonKey(r) : r).GroupBy(r => r).OrderByDescending(g => g.Count()).Take(5).Select(g => new { reason = g.Key, count = g.Count() }),
            },
            distribution = new[] { "0–39", "40–49", "50–59", "60–69", "70–79", "80–100" }.Select(b => new { band = b, count = distribution.GetValueOrDefault(b) }),
        };
    }

    private static string ReasonKey(string r) =>
        r.StartsWith("Average grade") ? "Low average grade" : r.Contains("past due") ? "Missing assignments" : r.Contains("late submission") ? "Late submissions" :
        r.StartsWith("Quiz average") ? "Low quiz scores" : r.StartsWith("Missed") ? "Missed quizzes" : r.StartsWith("No course activity") || r.StartsWith("Has never") ? "Inactivity" :
        r.StartsWith("Only") ? "Low completion" : r.StartsWith("Grades are declining") ? "Declining grades" : r.Contains("payment") ? "Payment overdue" : r.Contains("blocked") ? "Blocked access" : r;
}

public record MyInsightsQuery : IRequest<object>;

public class MyInsightsHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<MyInsightsQuery, object>
{
    public async Task<object> Handle(MyInsightsQuery q, CancellationToken ct)
    {
        var ids = await db.Enrolments.AsNoTracking().Where(e => e.UserId == user.UserId).Select(e => e.CourseId).ToListAsync(ct);
        var rows = await RiskEngine.ComputeAsync(db, ids, user.UserId, ct);
        var overall = rows.Count == 0 ? 0 : (int)Math.Round(rows.Average(r => r.RiskScore));
        var tips = new List<string>();
        if (rows.Any(r => r.Missing > 0)) tips.Add("Submit your missing assignments as soon as possible — talk to your lecturer if you need an extension.");
        if (rows.Any(r => r.AvgGrade < 50)) tips.Add("Your average is below 50% in at least one module. Book a consultation with the module lecturer.");
        if (rows.Any(r => r.QuizAvg < 50)) tips.Add("Practise with past papers and revise the lecture notes before the next quiz.");
        if (rows.Any(r => r.DaysSinceAccess is null or > 14)) tips.Add("Visit your courses regularly so you don't miss announcements and deadlines.");
        if (tips.Count == 0) tips.Add("Great work — you're on track in all your modules. Keep it up!");
        return new
        {
            riskScore = overall,
            level = overall >= 60 ? "High" : overall >= 35 ? "Medium" : "Low",
            courses = rows.Select(r => new { r.CourseId, r.CourseName, r.RiskScore, r.Level, r.AvgGrade, r.Missing, r.Late, r.QuizAvg, r.Completion, reasons = r.Reasons, r.GradeTrend }),
            tips,
        };
    }
}

public record NotifyStudentCommand(string StudentId, int CourseId, string Message) : IRequest;

public class NotifyStudentHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<NotifyStudentCommand>
{
    public async Task Handle(NotifyStudentCommand c, CancellationToken ct)
    {
        user.RequireTeacher();
        if (string.IsNullOrWhiteSpace(c.Message)) throw new BusinessRuleException("Message is required.");
        if (!user.IsAdmin && !await db.Courses.AnyAsync(x => x.Id == c.CourseId && x.LecturerId == user.UserId, ct)) throw new ForbiddenAccessException("You are not the lecturer of this course.");
        if (!await db.Enrolments.AnyAsync(e => e.CourseId == c.CourseId && e.UserId == c.StudentId, ct)) throw new BusinessRuleException("The student is not enrolled in this course.");

        var conv = await db.Conversations.Include(x => x.Members)
            .Where(x => x.Type == "private" && x.Members.Any(m => m.UserId == user.UserId) && x.Members.Any(m => m.UserId == c.StudentId)).FirstOrDefaultAsync(ct);
        if (conv is null) { conv = new Conversation { Type = "private", Members = [new() { UserId = user.UserId }, new() { UserId = c.StudentId }] }; db.Conversations.Add(conv); await db.SaveChangesAsync(ct); }
        db.Messages.Add(new Message { ConversationId = conv.Id, FromId = user.UserId, Text = c.Message.Trim() });
        var member = conv.Members.First(m => m.UserId == c.StudentId); member.Unread++; member.Deleted = false;
        var label = await db.CourseLabelAsync(c.CourseId, ct);
        db.Notifications.Add(new Notification { UserId = c.StudentId, Component = "Academic support", Subject = $"Message from {user.Name} about {label.Split('-')[0]}", Text = c.Message.Trim(), Link = "/insights/me" });
        db.Audit(user, "intervention", await db.UserNameAsync(c.StudentId, ct), $"Academic support message sent for {label}");
        await db.SaveChangesAsync(ct);
    }
}
