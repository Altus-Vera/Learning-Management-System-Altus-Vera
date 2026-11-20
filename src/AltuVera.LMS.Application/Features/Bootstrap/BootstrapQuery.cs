using System.Text.Json;
using AltuVera.LMS.Application.Common.Interfaces;
using AltuVera.LMS.Domain.Entities.Assessment;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.LMS.Application.Features.Bootstrap;

public record BootstrapQuery : IRequest<object>;

public class BootstrapHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<BootstrapQuery, object>
{
    private static JsonElement? Raw(string? json) => string.IsNullOrWhiteSpace(json) ? null : JsonDocument.Parse(json).RootElement.Clone();

    public static object SubmissionDto(Submission s) => new
    {
        studentId = s.StudentId, status = s.Status, onlineText = s.OnlineText, modifiedAt = s.ModifiedAt, grade = s.Grade, feedback = s.Feedback, gradedAt = s.GradedAt,
        files = s.Files.Select(f => new { id = f.Id, name = f.FileName, size = f.Size, uploadedAt = f.UploadedAt, downloadable = f.StoredName != "" }),
    };

    public async Task<object> Handle(BootstrapQuery q, CancellationToken ct)
    {
        var me = user.UserId;
        var isAdmin = user.IsAdmin;
        var isLecturer = user.Role == "Lecturer";

        var people = await (from u in db.Users.AsNoTracking()
                            join ur in db.UserRoles on u.Id equals ur.UserId
                            join r in db.Roles on ur.RoleId equals r.Id
                            select new { id = u.Id, name = (u.FirstName + " " + u.LastName).Trim(), email = u.Email, role = r.Name, indexNo = u.IndexNo, batchId = u.BatchCode, phone = u.Phone }).ToListAsync(ct);

        var enrolments = await db.Enrolments.AsNoTracking().ToListAsync(ct);
        var courseQuery = db.Courses.AsNoTracking().Include(c => c.Sections.OrderBy(s => s.SortOrder)).ThenInclude(s => s.Activities.OrderBy(a => a.SortOrder)).AsSplitQuery();
        var allCourses = await courseQuery.ToListAsync(ct);
        var courses = isAdmin ? allCourses
            : isLecturer ? allCourses.Where(c => c.LecturerId == me).ToList()
            : allCourses.Where(c => enrolments.Any(e => e.CourseId == c.Id && e.UserId == me)).ToList();
        var courseIds = courses.Select(c => c.Id).ToHashSet();
        var activityIds = courses.SelectMany(c => c.Sections.SelectMany(s => s.Activities.Select(a => a.Id))).ToHashSet();

        var states = await db.CourseUserStates.AsNoTracking().Where(s => s.UserId == me).ToListAsync(ct);
        var courseDtos = courses.Select(c =>
        {
            var st = states.FirstOrDefault(s => s.CourseId == c.Id);
            return new
            {
                id = c.Id, shortName = c.ShortName, fullName = c.FullName, category = c.Category, term = c.Term, color = c.Color, lecturer = c.LecturerName, lecturerId = c.LecturerId,
                starred = st?.Starred ?? false, hidden = st?.Hidden ?? false, lastAccess = st?.LastAccess ?? DateTime.UtcNow.AddDays(-30),
                sections = c.Sections.Select(s => new
                {
                    id = s.Id, title = s.Title, summary = s.Summary,
                    activities = s.Activities.Where(a => a.Visible || user.IsTeacher).Select(a => new { id = a.Id, type = a.Type, name = a.Name, description = a.Description, content = a.Content, visible = a.Visible, assign = Raw(a.AssignJson), quiz = Raw(a.QuizJson) }),
                }),
            };
        }).ToList();

        var subsQuery = db.Submissions.AsNoTracking().Include(s => s.Files).Where(s => activityIds.Contains(s.ActivityId));
        if (!user.IsTeacher) subsQuery = subsQuery.Where(s => s.StudentId == me);
        var submissions = (await subsQuery.ToListAsync(ct)).ToDictionary(s => $"{s.ActivityId}:{s.StudentId}", SubmissionDto);

        var completion = (await db.ActivityCompletions.AsNoTracking().Where(c => c.UserId == me).Select(c => c.ActivityId).ToListAsync(ct)).ToDictionary(id => id.ToString(), _ => true);

        var events = await db.CalendarEvents.AsNoTracking()
            .Where(e => e.Type == "site" || (e.Type == "course" && e.CourseId != null && courseIds.Contains(e.CourseId.Value)) || (e.Type == "user" && e.UserId == me))
            .Select(e => new { id = e.Id, title = e.Title, date = e.Date, type = e.Type, courseId = e.CourseId }).ToListAsync(ct);

        var discussions = await db.ForumDiscussions.AsNoTracking().Include(d => d.Posts).Where(d => activityIds.Contains(d.ActivityId)).ToListAsync(ct);
        var forums = discussions.GroupBy(d => d.ActivityId).ToDictionary(g => g.Key.ToString(), g => g.OrderByDescending(d => d.CreatedAt).Select(d => new
        {
            id = d.Id, subject = d.Subject, authorId = d.AuthorId, author = d.AuthorName, createdAt = d.CreatedAt, pinned = d.Pinned, locked = d.Locked,
            posts = d.Posts.OrderBy(p => p.At).Select(p => new { id = p.Id, parentId = p.ParentId, authorId = p.AuthorId, author = p.AuthorName, message = p.Message, at = p.At }),
        }).ToList());
        foreach (var a in courses.SelectMany(c => c.Sections.SelectMany(s => s.Activities)).Where(a => a.Type == "forum" && !forums.ContainsKey(a.Id.ToString())))
            forums[a.Id.ToString()] = [];
        var subscriptions = (await db.ForumSubscriptions.AsNoTracking().Where(s => s.UserId == me).ToListAsync(ct)).ToDictionary(s => s.ActivityId.ToString(), s => s.Subscribed);
        var starred = (await db.DiscussionStars.AsNoTracking().Where(s => s.UserId == me).Select(s => s.DiscussionId).ToListAsync(ct)).ToDictionary(id => id.ToString(), _ => true);

        var attemptsQuery = db.QuizAttempts.AsNoTracking().Where(a => activityIds.Contains(a.ActivityId));
        if (!user.IsTeacher) attemptsQuery = attemptsQuery.Where(a => a.UserId == me);
        var attempts = (await attemptsQuery.ToListAsync(ct)).GroupBy(a => a.ActivityId).ToDictionary(g => g.Key.ToString(), g => g.OrderBy(a => a.StartedAt).Select(a => new
        {
            id = a.Id, userId = a.UserId, startedAt = a.StartedAt, finishedAt = a.FinishedAt, answers = JsonSerializer.Deserialize<Dictionary<string, int>>(a.AnswersJson) ?? [], score = a.Score, maxScore = a.MaxScore,
        }).ToList());

        var feedbackRows = await db.FeedbackResponses.AsNoTracking().Where(f => activityIds.Contains(f.ActivityId)).ToListAsync(ct);
        var feedback = user.IsTeacher
            ? feedbackRows.GroupBy(f => f.ActivityId).ToDictionary(g => g.Key.ToString(), g => g.OrderByDescending(f => f.At).Select(f => (object)new { at = f.At, answers = Raw(f.AnswersJson) }).ToList())
            : [];
        var feedbackDone = feedbackRows.Where(f => f.UserId == me).ToDictionary(f => $"{f.ActivityId}:{me}", _ => true);

        var groups = (await db.ChoiceGroups.AsNoTracking().Include(g => g.Members).Where(g => activityIds.Contains(g.ActivityId)).ToListAsync(ct))
            .GroupBy(g => g.ActivityId).ToDictionary(g => g.Key.ToString(), g => g.OrderBy(x => x.Name).Select(x => new { id = x.Id, name = x.Name, description = x.Description, capacity = x.Capacity, members = x.Members.Select(m => m.MemberName) }).ToList());

        var commentQuery = db.SubmissionComments.AsNoTracking().Where(c => activityIds.Contains(c.ActivityId));
        if (!user.IsTeacher) commentQuery = commentQuery.Where(c => c.StudentId == me);
        var comments = (await commentQuery.OrderBy(c => c.At).ToListAsync(ct)).GroupBy(c => $"{c.ActivityId}:{c.StudentId}")
            .ToDictionary(g => g.Key, g => g.Select(c => new { id = c.Id, authorId = c.AuthorId, author = c.AuthorName, text = c.Text, at = c.At }).ToList());

        var memberships = await db.ConversationMembers.AsNoTracking().Where(m => m.UserId == me && !m.Deleted).ToListAsync(ct);
        var convIds = memberships.Select(m => m.ConversationId).ToList();
        var convs = await db.Conversations.AsNoTracking().Include(c => c.Members).Include(c => c.Messages).Where(c => convIds.Contains(c.Id)).ToListAsync(ct);
        var deleted = await db.MessageDeletions.AsNoTracking().Where(d => d.UserId == me).Select(d => d.MessageId).ToListAsync(ct);
        var conversations = convs.Select(c =>
        {
            var m = memberships.First(x => x.ConversationId == c.Id);
            return new { id = c.Id, type = c.Type, name = c.Name, members = c.Members.Select(x => x.UserId), starred = m.Starred, muted = m.Muted, unread = m.Unread, messages = c.Messages.Where(x => !deleted.Contains(x.Id)).OrderBy(x => x.At).Select(x => new { id = x.Id, from = x.FromId, text = x.Text, at = x.At }) };
        }).ToList();
        var links = await db.ContactLinks.AsNoTracking().Where(l => l.RequesterId == me || l.TargetId == me).ToListAsync(ct);
        var blocked = await db.UserBlocks.AsNoTracking().Where(b => b.UserId == me).Select(b => b.BlockedId).ToListAsync(ct);
        var notifications = await db.Notifications.AsNoTracking().Where(n => n.UserId == me).OrderByDescending(n => n.At)
            .Select(n => new { id = n.Id, component = n.Component, subject = n.Subject, text = n.Text, link = n.Link, at = n.At, read = n.Read }).Take(100).ToListAsync(ct);

        var prefJson = await db.UserPreferences.AsNoTracking().Where(p => p.UserId == me).Select(p => p.Json).FirstOrDefaultAsync(ct);
        var prefs = Raw(prefJson);

        var blocks = await db.AccessBlocks.AsNoTracking().Where(b => isAdmin || b.StudentId == me).ToListAsync(ct);
        var extensions = await db.SubmissionExtensions.AsNoTracking().Where(e => user.IsTeacher || e.StudentId == me).ToListAsync(ct);
        var overrides = user.IsTeacher ? await db.GradeOverrides.AsNoTracking().ToListAsync(ct) : [];
        var payments = isAdmin ? await db.Payments.AsNoTracking().ToListAsync(ct) : [];
        var audit = isAdmin ? await db.AuditLogs.AsNoTracking().OrderByDescending(a => a.At).Take(500).Select(a => new { id = a.Id, at = a.At, actor = a.Actor, role = a.Role, kind = a.Kind, target = a.Target, detail = a.Detail }).ToListAsync(ct) : [];
        var autoBlock = isAdmin && (await db.SystemSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == "AutoBlockUnpaid", ct))?.Value == "true";
        var batches = await db.Batches.AsNoTracking().Select(b => new { id = b.Code, name = b.Name, programme = b.Programme, intake = b.Intake, year = b.Year, semester = b.Semester }).ToListAsync(ct);

        var visibleEnrolments = user.IsTeacher ? enrolments : enrolments.Where(e => e.UserId == me).ToList();

        return new
        {
            me = new { id = me, name = user.Name, role = user.Role },
            people,
            lms = new { courses = courseDtos, submissions, completion, events },
            activity = new { forums, subscriptions, starredDiscussions = starred, attempts, feedback, feedbackDone, groups, comments },
            social = new
            {
                conversations,
                contacts = links.Where(l => l.Accepted).Select(l => l.RequesterId == me ? l.TargetId : l.RequesterId),
                requests = links.Where(l => !l.Accepted && l.TargetId == me).Select(l => l.RequesterId),
                sentRequests = links.Where(l => !l.Accepted && l.RequesterId == me).Select(l => l.TargetId),
                blocked,
                notifications,
            },
            prefs,
            admin = new
            {
                batches,
                enrolments = visibleEnrolments.GroupBy(e => e.CourseId).ToDictionary(g => g.Key.ToString(), g => g.Select(e => e.UserId).ToList()),
                courseLecturers = allCourses.ToDictionary(c => c.Id.ToString(), c => c.LecturerName),
                payments = payments.ToDictionary(p => $"{p.CourseId}:{p.StudentId}", p => new { amount = p.Amount, paid = p.Paid, dueDate = p.DueDate, paidAt = p.PaidAt, reference = p.Reference }),
                accountBlocks = blocks.Where(b => b.CourseId == null).GroupBy(b => b.StudentId).ToDictionary(g => g.Key, g => new { reason = g.First().Reason, at = g.First().At, by = g.First().BlockedBy }),
                courseBlocks = blocks.Where(b => b.CourseId != null).GroupBy(b => $"{b.CourseId}:{b.StudentId}").ToDictionary(g => g.Key, g => new { reason = g.First().Reason, at = g.First().At, by = g.First().BlockedBy }),
                extensions = extensions.ToDictionary(e => $"{e.ActivityId}:{e.StudentId}", e => e.Until),
                overrides = overrides.ToDictionary(o => $"{o.ActivityId}:{o.StudentId}", o => new { by = o.OverriddenBy, at = o.At, previous = o.Previous }),
                autoBlockUnpaid = autoBlock,
                audit,
            },
        };
    }
}
