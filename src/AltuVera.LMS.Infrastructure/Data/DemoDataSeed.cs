using System.Text.Json;
using AltuVera.LMS.Domain.Entities.Academics;
using AltuVera.LMS.Domain.Entities.Assessment;
using AltuVera.LMS.Domain.Entities.Forums;
using AltuVera.LMS.Domain.Entities.Messaging;
using AltuVera.LMS.Domain.Entities.Registrar;
using AltuVera.LMS.Domain.Entities.Users;
using AltuVera.LMS.Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.LMS.Infrastructure.Data;

public static class DemoDataSeed
{
    public const string StudentPassword = "Student@123";
    public const string LecturerPassword = "Lecturer@123";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static DateTime D(int days, int h = 23, int m = 59) => DateTime.Today.AddDays(days).AddHours(h).AddMinutes(m).ToUniversalTime();

    private record SeedUser(string First, string Last, string Email, string? Batch = null);

    private static readonly SeedUser[] Lecturers =
    [
        new("Dr. K.", "Perera", "kperera@altusvera.lk"),
        new("Mr. S.", "Fernando", "sfernando@altusvera.lk"),
        new("Prof. N.", "Silva", "nsilva@altusvera.lk"),
        new("Ms. A.", "Jayasinghe", "ajayasinghe@altusvera.lk"),
        new("Dr. R.", "Wickrama", "rwickrama@altusvera.lk"),
        new("Mr. P.", "Bandara", "pbandara@altusvera.lk"),
    ];

    private static readonly SeedUser[] Students =
    [
        new("DVD", "Silva", "dvdsilva@students.altusvera.lk", "se22"),
        new("GPAD", "Nilwala", "gpadnilwala@students.altusvera.lk", "se22"),
        new("KWKS", "Wijerathna", "kwkswijerathna@students.altusvera.lk", "se22"),
        new("TDJ", "Pathirana", "tdjpathirana@students.altusvera.lk", "se22"),
        new("HN", "Kanakarathne", "hnkanakarathne@students.altusvera.lk", "se22"),
        new("MAS", "Perera", "masperera@students.altusvera.lk", "se22"),
        new("RPK", "Kodithuwakku", "rpkkodithuwakku@students.altusvera.lk", "se22"),
        new("YAR", "Ahmed", "yarahmed@students.altusvera.lk", "se22"),
        new("MAH", "Sheriffdeen", "mahsheriffdeen@students.altusvera.lk", "cs22"),
        new("DBN", "Ariyathilaka", "dbnariyathilaka@students.altusvera.lk", "cs22"),
        new("CKM", "Rathnayaka", "ckmrathnayaka@students.altusvera.lk", "cs22"),
        new("OVD", "Weerasena", "ovdweerasena@students.altusvera.lk", "bm23"),
        new("PLA", "Lakmali", "plalakmali@students.altusvera.lk", "bm23"),
        new("GTK", "Premarathna", "gtkpremarathna@students.altusvera.lk", "bm23"),
    ];

    public static async Task SeedAsync(AppDbContext db, UserManager<AppUser> users)
    {
        if (await db.Courses.AnyAsync()) return;

        db.Batches.AddRange(
            new Batch { Code = "se22", Name = "BSc (Hons) Software Engineering — 22.2", Programme = "Software Engineering", Intake = "22.2", Year = 4, Semester = 1 },
            new Batch { Code = "cs22", Name = "BSc (Hons) Computer Science — 22.2", Programme = "Computer Science", Intake = "22.2", Year = 4, Semester = 1 },
            new Batch { Code = "bm23", Name = "BSc (Hons) Business Management — 23.1", Programme = "Business Management", Intake = "23.1", Year = 3, Semester = 2 });

        var lecturerIds = new List<string>();
        foreach (var l in Lecturers) lecturerIds.Add(await EnsureUser(users, l, nameof(UserRole.Lecturer), LecturerPassword, null, null));
        var studentIds = new List<string>();
        for (var i = 0; i < Students.Length; i++)
        {
            var s = Students[i];
            var index = $"{s.Batch![..2].ToUpper()}/{(s.Batch == "bm23" ? "23.1" : "22.2")}/{1040 + i:0000}";
            studentIds.Add(await EnsureUser(users, s, nameof(UserRole.Student), StudentPassword, index, s.Batch));
        }
        var core = studentIds.Take(6).ToList();

        var courseDefs = new[]
        {
            ("BS401.3", "Business Policy and Strategy", "Faculty of Business", "Year 4 — Semester 1", "#0033A0", 0),
            ("CS404.3", "Parallel and Distributed Computing", "Faculty of Computing", "Year 4 — Semester 2", "#0D9488", 1),
            ("PR400", "Special Award Project", "Faculty of Computing", "Year 4 — Semester 1", "#7C3AED", 2),
            ("SE402.3", "Software Quality Assurance", "Faculty of Computing", "Year 4 — Semester 1", "#DB2777", 3),
            ("MG403.3", "Entrepreneurship and Innovation", "Faculty of Business", "Year 4 — Semester 1", "#EA580C", 4),
            ("CS301.3", "Computer Networks", "Faculty of Computing", "Year 3 — Semester 2", "#0891B2", 5),
        };

        var courses = new List<Course>();
        foreach (var (code, name, cat, term, color, li) in courseDefs)
        {
            var c = new Course { ShortName = code, FullName = name, Category = cat, Term = term, Color = color, LecturerName = $"{Lecturers[li].First} {Lecturers[li].Last}", LecturerId = lecturerIds[li], Sections = BuildSections(code) };
            courses.Add(c);
            db.Courses.Add(c);
        }
        await db.SaveChangesAsync();

        var rnd = new Random(42);
        foreach (var c in courses)
        {
            foreach (var sid in core) db.Enrolments.Add(new Enrolment { CourseId = c.Id, UserId = sid });
            for (var si = 0; si < studentIds.Count; si++)
            {
                var paid = (si + c.Id) % 5 != 0;
                db.Payments.Add(new Payment { CourseId = c.Id, StudentId = studentIds[si], Amount = 45000, Paid = paid, DueDate = D(-10 + c.Id % 3), PaidAt = paid ? D(-20) : null, Reference = paid ? $"AV-{c.Id}-{1000 + si}" : "" });
            }
            db.CourseUserStates.Add(new CourseUserState { CourseId = c.Id, UserId = core[0], Starred = c.ShortName == "BS401.3", LastAccess = DateTime.UtcNow.AddDays(-courses.IndexOf(c) * 1.5) });

            var acts = c.Sections.SelectMany(s => s.Activities.Select(a => (s, a))).ToList();
            var ai = 0;
            foreach (var (s, a) in acts)
            {
                if (s.SortOrder <= 3 && s.Activities.IndexOf(a) < 5 && a.Type != "label")
                    db.ActivityCompletions.Add(new ActivityCompletion { ActivityId = a.Id, UserId = core[0] });

                if (a.Type == "assign")
                {
                    var settings = JsonSerializer.Deserialize<AssignSeed>(a.AssignJson!, Json)!;
                    var due = settings.DueDate!.Value;
                    for (var si = 0; si < core.Count; si++)
                    {
                        var past = due < DateTime.UtcNow;
                        var done = past ? (si + ai) % 4 != 0 : si % 3 == 1;
                        if (!done) continue;
                        var at = due.AddDays(-(1 + si));
                        var graded = past && si % 2 == 0;
                        db.Submissions.Add(new Submission
                        {
                            ActivityId = a.Id, StudentId = core[si], Status = "submitted", ModifiedAt = at,
                            Grade = graded ? 55 + ((si * 7 + ai * 3) % 40) : null, Feedback = graded ? "Good work. Improve the referencing." : "", GradedAt = graded ? D(-1, 10, 0) : null,
                            Files = [new SubmissionFile { FileName = $"{Students[si].Last}_{a.Name.Replace(' ', '_')}.pdf", StoredName = "", Size = 420_000 + si * 51_000, UploadedAt = at }],
                        });
                    }
                    ai++;
                }
                else if (a.Type == "forum")
                {
                    var news = a.Name == "Announcements";
                    var lect = c.LecturerName;
                    if (news)
                    {
                        db.ForumDiscussions.Add(new ForumDiscussion { ActivityId = a.Id, Subject = "Lecture rescheduled to Friday", AuthorId = c.LecturerId!, AuthorName = lect, CreatedAt = D(-2, 10, 15), Pinned = true, Posts = [new ForumPost { AuthorId = c.LecturerId!, AuthorName = lect, Message = "This week’s lecture will be held on Friday at 10:00 AM in Hall C2-004 instead of Monday.", At = D(-2, 10, 15) }] });
                        db.ForumDiscussions.Add(new ForumDiscussion { ActivityId = a.Id, Subject = "Assignment groups are final", AuthorId = c.LecturerId!, AuthorName = lect, CreatedAt = D(-6, 10, 15), Locked = true, Posts = [new ForumPost { AuthorId = c.LecturerId!, AuthorName = lect, Message = "The group list is now final. All groups must have members registered through the group choice activity.", At = D(-6, 10, 15) }] });
                    }
                    else
                    {
                        var d1 = new ForumDiscussion { ActivityId = a.Id, Subject = "Clarification on Tutorial 05 question 3", AuthorId = core[1], AuthorName = "GPAD Nilwala", CreatedAt = D(-3, 14, 0) };
                        db.ForumDiscussions.Add(d1);
                        await db.SaveChangesAsync();
                        var p1 = new ForumPost { DiscussionId = d1.Id, AuthorId = core[1], AuthorName = "GPAD Nilwala", Message = "For question 3, should we use the 2023 annual report or the latest one?", At = D(-3, 14, 0) };
                        db.ForumPosts.Add(p1); await db.SaveChangesAsync();
                        var p2 = new ForumPost { DiscussionId = d1.Id, ParentId = p1.Id, AuthorId = c.LecturerId!, AuthorName = lect, Message = "Use the latest annual report available on the company website.", At = D(-3, 16, 0) };
                        db.ForumPosts.Add(p2); await db.SaveChangesAsync();
                        db.ForumPosts.Add(new ForumPost { DiscussionId = d1.Id, ParentId = p2.Id, AuthorId = core[2], AuthorName = "KWKS Wijerathna", Message = "Thank you! That clears it up.", At = D(-2, 9, 0) });
                        db.ForumDiscussions.Add(new ForumDiscussion { ActivityId = a.Id, Subject = "Study group for the final exam", AuthorId = core[3], AuthorName = "TDJ Pathirana", CreatedAt = D(-1, 18, 0), Posts = [new ForumPost { AuthorId = core[3], AuthorName = "TDJ Pathirana", Message = "Anyone interested in a weekend study group at the library? Reply below.", At = D(-1, 18, 0) }] });
                    }
                }
                else if (a.Type == "choice")
                {
                    string[] fake = ["Balasooriya S", "Fernando TPR", "Kodithuwakku RPK", "Sheriffdeen MAH", "Ariyathilaka DBN", "Chandrasiri DMH", "Iniyan M", "Karunanayake AS", "Rashmika GDT", "Rathnayaka CKM", "Weerasena OVD"];
                    var groups = new[] { ("Group A", "Topic: Corporate strategy of a listed company", 5), ("Group B", "Topic: Competitive strategy in the telecom sector", 3), ("Group C", "Topic: Strategy implementation in SMEs", 2), ("Group D", "Topic: Digital transformation strategy", 1) };
                    var fi = 0;
                    foreach (var (gn, desc, n) in groups)
                        db.ChoiceGroups.Add(new ChoiceGroup { ActivityId = a.Id, Name = gn, Description = desc, Capacity = 5, Members = Enumerable.Range(0, n).Select(_ => new ChoiceGroupMember { MemberName = fake[fi++] }).ToList() });
                }
                else if (a.Type == "feedback")
                {
                    for (var i = 0; i < 14; i++)
                    {
                        var ans = new Dictionary<string, object> { ["q1"] = 3 + (i % 3 == 0 ? 1 : i % 2), ["q2"] = 3 + (i % 2), ["q3"] = Math.Min(5, 4 + (i % 4 == 0 ? 0 : 1) - (i % 5 == 0 ? 1 : 0)), ["q4"] = 2 + (i % 3), ["q5"] = Math.Min(5, 3 + (i % 3 == 1 ? 2 : i % 2)), ["q6"] = i % 4 == 0 ? "More practical examples would help." : "" };
                        db.FeedbackResponses.Add(new FeedbackResponse { ActivityId = a.Id, AnswersJson = JsonSerializer.Serialize(ans), At = D(-(i + 1), 10, 0) });
                    }
                }
            }
        }

        db.CalendarEvents.AddRange(
            new CalendarEvent { Title = "Mid-semester break begins", Date = D(12, 8, 0), Type = "site" },
            new CalendarEvent { Title = "Guest lecture — Strategy in Practice", Date = D(3, 14, 0), Type = "course", CourseId = courses[0].Id },
            new CalendarEvent { Title = "Project supervisor meeting", Date = D(1, 10, 30), Type = "user", CourseId = courses[2].Id, UserId = core[0] });

        var me = core[0];
        var group = new Conversation { Type = "group", Name = "BS401.3 — Group A", Members = core.Take(4).Select(u => new ConversationMember { UserId = u, Starred = u == me, Unread = u == me ? 2 : 0 }).ToList(),
            Messages = [new() { FromId = core[1], Text = "Hi all, shall we meet tomorrow to finish the slides?", At = DateTime.UtcNow.AddMinutes(-300) }, new() { FromId = me, Text = "Yes, 10 AM at the library works for me.", At = DateTime.UtcNow.AddMinutes(-280) }, new() { FromId = core[2], Text = "I will bring the financial analysis section.", At = DateTime.UtcNow.AddMinutes(-60) }, new() { FromId = core[3], Text = "Great, see you there 👍", At = DateTime.UtcNow.AddMinutes(-45) }] };
        var withLecturer = new Conversation { Type = "private", Members = [new() { UserId = me, Unread = 1 }, new() { UserId = lecturerIds[0] }],
            Messages = [new() { FromId = me, Text = "Good morning sir, could I get an extension for Tutorial 08? I was ill last week.", At = DateTime.UtcNow.AddMinutes(-1500) }, new() { FromId = lecturerIds[0], Text = "Please submit a medical certificate to the faculty office and I will grant a 3-day extension.", At = DateTime.UtcNow.AddMinutes(-1400) }] };
        var withPeer = new Conversation { Type = "private", Members = [new() { UserId = me }, new() { UserId = core[4] }],
            Messages = [new() { FromId = core[4], Text = "Did you download the past papers?", At = DateTime.UtcNow.AddMinutes(-4000) }, new() { FromId = me, Text = "Yes, they are in the Quizzes section folder.", At = DateTime.UtcNow.AddMinutes(-3990) }] };
        db.Conversations.AddRange(group, withLecturer, withPeer);

        db.ContactLinks.AddRange(new ContactLink { RequesterId = me, TargetId = core[1], Accepted = true }, new ContactLink { RequesterId = me, TargetId = core[2], Accepted = true }, new ContactLink { RequesterId = core[5], TargetId = me });

        db.Notifications.AddRange(
            new Notification { UserId = me, Component = "Assignment", Subject = "Tutorial 06 has been graded", Text = "Your submission for Tutorial 06 has been graded. View the feedback in the assignment.", Link = "/grades", At = DateTime.UtcNow.AddMinutes(-90) },
            new Notification { UserId = me, Component = "Forum", Subject = "New post: Lecture rescheduled to Friday", Text = "Module Lecturer posted in Announcements: This week’s lecture will be held on Friday.", At = DateTime.UtcNow.AddDays(-2) },
            new Notification { UserId = me, Component = "Assignment", Subject = "Submission received", Text = "You have submitted Assignment Presentation Slides.", At = DateTime.UtcNow.AddDays(-3), Read = true },
            new Notification { UserId = me, Component = "System", Subject = "You earned a badge: Early Submitter", Text = "Congratulations! You have been awarded the badge “Early Submitter”.", Link = "/badges", At = DateTime.UtcNow.AddDays(-7), Read = true });

        await db.SaveChangesAsync();
    }

    private static async Task<string> EnsureUser(UserManager<AppUser> users, SeedUser s, string role, string password, string? index, string? batch)
    {
        var existing = await users.FindByEmailAsync(s.Email);
        if (existing is not null) return existing.Id;
        var u = new AppUser { FirstName = s.First, LastName = s.Last, Email = s.Email, UserName = s.Email, EmailConfirmed = true, IsActive = true, IndexNo = index, BatchCode = batch, Phone = index is null ? null : "0771234567" };
        var result = await users.CreateAsync(u, password);
        if (!result.Succeeded) throw new InvalidOperationException(string.Join(", ", result.Errors.Select(e => e.Description)));
        await users.AddToRoleAsync(u, role);
        return u.Id;
    }

    private record AssignSeed(DateTime? AllowSubmissionsFrom, DateTime? DueDate, DateTime? CutOffDate, DateTime? RemindToGradeBy, bool AcceptingSubmissions, bool FileSubmissions, bool OnlineText, int MaxFiles, int MaxSizeMb, string AcceptedTypes, bool RequireSubmitButton, int MaxGrade);

    private static string Assign(DateTime? from = null, DateTime? due = null, DateTime? cut = null, int maxFiles = 1, int maxSize = 20, string types = ".pdf,.docx,.pptx,.zip") =>
        JsonSerializer.Serialize(new AssignSeed(from ?? D(-14, 0, 0), due ?? D(7), cut ?? D(9), D(14), true, true, false, maxFiles, maxSize, types, true, 100), Json);

    private static string Quiz(DateTime open, DateTime close, int mins, int attempts) =>
        JsonSerializer.Serialize(new { openDate = open, closeDate = close, timeLimitMins = mins, attemptsAllowed = attempts, gradingMethod = "Highest grade", maxGrade = 10, reviewAfterClose = true }, Json);

    private static List<CourseSection> BuildSections(string code)
    {
        Activity A(string type, string name, string? desc = null, bool visible = true, string? content = null, string? assign = null, string? quiz = null) =>
            new() { Type = type, Name = name, Description = desc, Visible = visible, Content = content, AssignJson = assign, QuizJson = quiz };

        List<Activity> Ordered(IEnumerable<Activity> list) { var l = list.ToList(); for (var i = 0; i < l.Count; i++) l[i].SortOrder = i; return l; }

        return
        [
            new() { SortOrder = 1, Title = "General", Summary = "Course announcements and module information.", Activities = Ordered([
                A("label", "Welcome", content: $"Welcome to {code}! Please read the module handbook before the first lecture. Lecture recordings are available on MS Teams within 24 hours."),
                A("forum", "Announcements", "General news and announcements"),
                A("forum", "Discussion Forum", "Ask questions and discuss the module with your peers."),
                A("page", "Module Information", content: $"Module code: {code}\nCredits: 3\nAssessment: Coursework 40% · Final examination 60%\n\nLearning outcomes\n• Analyse key concepts covered in the module.\n• Apply theory to practical case studies.\n• Communicate findings clearly in written and oral form.\n\nLecture schedule\nMonday 08:30 – 10:30 · Hall C2-004\nTutorial: Wednesday 13:00 – 14:00"),
                A("resource", $"{code} Module Outline"),
                A("url", "Recorded Lectures (MS Teams)"),
                A("feedback", "Student Feedback Form", "Please rate this module. The feedback is anonymous and helps us improve the course."),
            ]) },
            new() { SortOrder = 2, Title = "Lecture Notes", Activities = Ordered(Enumerable.Range(1, 10).Select(i => A("resource", $"Lecture Note {i:00}", visible: i <= 8))) },
            new() { SortOrder = 3, Title = "Tutorials", Activities = Ordered(Enumerable.Range(0, 10).Select(i => A("assign", $"Tutorial {i + 1:00}", $"Answer all questions in Tutorial {i + 1} and upload a single PDF. Handwritten answers must be scanned clearly.", assign: Assign(D(-42 + i * 7 - 7, 0, 0), D(-42 + i * 7), D(-42 + i * 7 + 2))))) },
            new() { SortOrder = 4, Title = "Assignment", Summary = "Group assignment — 40% of the final mark.", Activities = Ordered([
                A("resource", "Assignment Description"),
                A("choice", "Assignment Group Enrollment"),
                A("assign", "Assignment Presentation Slides", "Upload your group presentation slides (PPTX or PDF).", assign: Assign(due: D(-3), cut: D(-1), maxFiles: 2, types: ".pptx,.pdf")),
                A("assign", "Assignment Final Report Submission", "Submit the final report. Turnitin similarity must be below 20%.", assign: Assign(due: D(10), cut: D(12), maxSize: 50)),
            ]) },
            new() { SortOrder = 5, Title = "Quizzes", Activities = Ordered([
                A("quiz", "In-class Test 01", "The test covers lectures 1–4.", quiz: Quiz(D(-20, 8, 30), D(-20, 9, 30), 45, 1)),
                A("quiz", "Mid-term Quiz", "Answer all questions. You have two attempts; the highest grade counts.", quiz: Quiz(D(-1, 8, 0), D(5), 30, 2)),
                A("folder", "Past Papers"),
            ]) },
            new() { SortOrder = 6, Title = "Topic 6" },
        ];
    }
}
