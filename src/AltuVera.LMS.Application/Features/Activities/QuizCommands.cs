using System.Security.Cryptography;
using System.Text.Json;
using AltuVera.LMS.Application.Common;
using AltuVera.LMS.Application.Common.Exceptions;
using AltuVera.LMS.Application.Common.Interfaces;
using AltuVera.LMS.Application.Features.Courses;
using AltuVera.LMS.Domain.Entities.Assessment;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.LMS.Application.Features.Activities;

public class QuizSettings
{
    public DateTime? OpenDate { get; set; }
    public DateTime? CloseDate { get; set; }
    public int TimeLimitMins { get; set; } = 30;
    public int AttemptsAllowed { get; set; } = 1;
    public string GradingMethod { get; set; } = "Highest grade";
    public decimal MaxGrade { get; set; } = 10;
    public bool ReviewAfterClose { get; set; } = true;
    /// Number of questions drawn from the bank per attempt; 0 means every matching question.
    public int QuestionCount { get; set; }
    public string Category { get; set; } = "All";
    public bool ShuffleQuestions { get; set; } = true;
    public bool ShuffleAnswers { get; set; } = true;
}

public record LayoutItem(int QuestionId, int[] Order);

internal static class QuizRules
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<(QuizSettings Settings, int CourseId)> LoadAsync(IApplicationDbContext db, int activityId, CancellationToken ct)
    {
        var a = await db.Activities.AsNoTracking().Include(x => x.Section).FirstOrDefaultAsync(x => x.Id == activityId && x.Type == "quiz", ct) ?? throw new NotFoundException("Quiz not found");
        return (JsonSerializer.Deserialize<QuizSettings>(a.QuizJson ?? "{}", Json) ?? new QuizSettings(), a.Section!.CourseId);
    }

    public static IQueryable<Question> Pool(IApplicationDbContext db, int courseId, string? category) =>
        db.Questions.Where(q => q.CourseId == courseId && (category == null || category == "All" || q.Category == category));

    public static string[] Options(Question q) => JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? [];

    public static void Shuffle<T>(IList<T> list) { for (var i = list.Count - 1; i > 0; i--) { var j = RandomNumberGenerator.GetInt32(i + 1); (list[i], list[j]) = (list[j], list[i]); } }

    public static List<LayoutItem> Layout(QuizAttempt a) => string.IsNullOrEmpty(a.LayoutJson) ? [] : JsonSerializer.Deserialize<List<LayoutItem>>(a.LayoutJson, Json) ?? [];

    /// The paper as the student sees it — options in display order, no correct answers.
    public static async Task<object> PaperAsync(IApplicationDbContext db, QuizAttempt a, CancellationToken ct)
    {
        var layout = Layout(a);
        var ids = layout.Select(l => l.QuestionId).ToList();
        var qs = await db.Questions.AsNoTracking().Where(q => ids.Contains(q.Id)).ToDictionaryAsync(q => q.Id, ct);
        return layout.Where(l => qs.ContainsKey(l.QuestionId)).Select(l => { var opts = Options(qs[l.QuestionId]); return new { id = l.QuestionId, text = qs[l.QuestionId].Text, options = l.Order.Select(i => opts[i]).ToArray() }; }).ToList();
    }
}

// ── Question bank ────────────────────────────────────────────────────────────

public record GetQuestionBankQuery(int CourseId) : IRequest<object>;

public class GetQuestionBankHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<GetQuestionBankQuery, object>
{
    public async Task<object> Handle(GetQuestionBankQuery q, CancellationToken ct)
    {
        user.RequireTeacher();
        await UpdateActivityHandler.EnsureTeachesAsync(db, user, q.CourseId, ct);
        var rows = await db.Questions.AsNoTracking().Where(x => x.CourseId == q.CourseId).OrderBy(x => x.Category).ThenBy(x => x.Id).ToListAsync(ct);
        return rows.Select(x => new { id = x.Id, category = x.Category, text = x.Text, options = QuizRules.Options(x), correctIndex = x.CorrectIndex, explanation = x.Explanation, createdBy = x.CreatedBy, createdAt = x.CreatedAt });
    }
}

public record SaveQuestionCommand(int? Id, int CourseId, string Category, string Text, string[] Options, int CorrectIndex, string? Explanation) : IRequest<int>;

public class SaveQuestionHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<SaveQuestionCommand, int>
{
    public async Task<int> Handle(SaveQuestionCommand c, CancellationToken ct)
    {
        user.RequireTeacher();
        await UpdateActivityHandler.EnsureTeachesAsync(db, user, c.CourseId, ct);
        Validate(c.Text, c.Options, c.CorrectIndex);
        Question q;
        if (c.Id is null) { q = new Question { CourseId = c.CourseId, CreatedBy = user.Name }; db.Questions.Add(q); }
        else q = await db.Questions.FirstOrDefaultAsync(x => x.Id == c.Id && x.CourseId == c.CourseId, ct) ?? throw new NotFoundException("Question not found");
        q.Category = string.IsNullOrWhiteSpace(c.Category) ? "General" : c.Category.Trim();
        q.Text = c.Text.Trim();
        q.OptionsJson = JsonSerializer.Serialize(c.Options.Select(o => o.Trim()));
        q.CorrectIndex = c.CorrectIndex;
        q.Explanation = string.IsNullOrWhiteSpace(c.Explanation) ? null : c.Explanation.Trim();
        await db.SaveChangesAsync(ct);
        return q.Id;
    }

    public static void Validate(string text, string[] options, int correct)
    {
        if (string.IsNullOrWhiteSpace(text)) throw new BusinessRuleException("Question text is required.");
        var opts = options.Where(o => !string.IsNullOrWhiteSpace(o)).ToArray();
        if (opts.Length != options.Length) throw new BusinessRuleException("Answer options cannot be empty.");
        if (opts.Length is < 2 or > 6) throw new BusinessRuleException("A question needs between 2 and 6 answer options.");
        if (opts.Select(o => o.Trim().ToLowerInvariant()).Distinct().Count() != opts.Length) throw new BusinessRuleException("Answer options must be different.");
        if (correct < 0 || correct >= opts.Length) throw new BusinessRuleException("Select the correct answer.");
    }
}

public record DeleteQuestionCommand(int Id) : IRequest;

public class DeleteQuestionHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<DeleteQuestionCommand>
{
    public async Task Handle(DeleteQuestionCommand c, CancellationToken ct)
    {
        user.RequireTeacher();
        var q = await db.Questions.FindAsync([c.Id], ct) ?? throw new NotFoundException("Question not found");
        await UpdateActivityHandler.EnsureTeachesAsync(db, user, q.CourseId, ct);
        db.Questions.Remove(q);
        await db.SaveChangesAsync(ct);
    }
}

public record ImportQuestionsCommand(int CourseId, string Category, string Text) : IRequest<int>;

/// Accepts blocks separated by blank lines: a question line, then options; the correct option starts with "*".
public class ImportQuestionsHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<ImportQuestionsCommand, int>
{
    public async Task<int> Handle(ImportQuestionsCommand c, CancellationToken ct)
    {
        user.RequireTeacher();
        await UpdateActivityHandler.EnsureTeachesAsync(db, user, c.CourseId, ct);
        var blocks = c.Text.Replace("\r", "").Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (blocks.Length == 0) throw new BusinessRuleException("Nothing to import.");
        var added = new List<Question>();
        for (var b = 0; b < blocks.Length; b++)
        {
            var lines = blocks[b].Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (lines.Length < 3) throw new BusinessRuleException($"Question {b + 1}: needs a question and at least two options.");
            var text = System.Text.RegularExpressions.Regex.Replace(lines[0], @"^\d+[\.\)]\s*", "");
            var opts = new List<string>(); var correct = -1;
            foreach (var raw in lines.Skip(1))
            {
                var isCorrect = raw.StartsWith('*');
                var o = System.Text.RegularExpressions.Regex.Replace(raw.TrimStart('*').Trim(), @"^[a-fA-F][\.\)]\s*", "");
                if (isCorrect) correct = opts.Count;
                opts.Add(o);
            }
            if (correct < 0) throw new BusinessRuleException($"Question {b + 1}: mark the correct option with *.");
            try { SaveQuestionHandler.Validate(text, [.. opts], correct); } catch (BusinessRuleException e) { throw new BusinessRuleException($"Question {b + 1}: {e.Message}"); }
            added.Add(new Question { CourseId = c.CourseId, Category = string.IsNullOrWhiteSpace(c.Category) ? "General" : c.Category.Trim(), Text = text, OptionsJson = JsonSerializer.Serialize(opts), CorrectIndex = correct, CreatedBy = user.Name });
        }
        db.Questions.AddRange(added);
        db.Audit(user, "settings", await db.CourseLabelAsync(c.CourseId, ct), $"Imported {added.Count} question(s) into the question bank");
        await db.SaveChangesAsync(ct);
        return added.Count;
    }
}

// ── Attempts ─────────────────────────────────────────────────────────────────

public record StartQuizAttemptCommand(int QuizId) : IRequest<object>;

public class StartQuizAttemptHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<StartQuizAttemptCommand, object>
{
    public async Task<object> Handle(StartQuizAttemptCommand c, CancellationToken ct)
    {
        await db.EnsureStudentCanActAsync(user, c.QuizId, ct);
        var (s, courseId) = await QuizRules.LoadAsync(db, c.QuizId, ct);
        var now = DateTime.UtcNow;
        if (s.OpenDate is not null && now < s.OpenDate) throw new BusinessRuleException("This quiz is not open yet.");
        if (s.CloseDate is not null && now > s.CloseDate) throw new BusinessRuleException("This quiz has closed.");
        var used = await db.QuizAttempts.CountAsync(a => a.ActivityId == c.QuizId && a.UserId == user.UserId && a.FinishedAt != null, ct);
        if (s.AttemptsAllowed > 0 && used >= s.AttemptsAllowed) throw new BusinessRuleException("No more attempts are allowed.");

        var open = await db.QuizAttempts.FirstOrDefaultAsync(a => a.ActivityId == c.QuizId && a.UserId == user.UserId && a.FinishedAt == null, ct);
        if (open is null || string.IsNullOrEmpty(open.LayoutJson))
        {
            var pool = await QuizRules.Pool(db, courseId, s.Category).Select(q => new { q.Id, q.OptionsJson }).ToListAsync(ct);
            if (pool.Count == 0) throw new BusinessRuleException("This quiz has no questions yet. Please contact your lecturer.");
            var picked = pool.ToList();
            QuizRules.Shuffle(picked);
            picked = picked.Take(s.QuestionCount > 0 ? Math.Min(s.QuestionCount, pool.Count) : pool.Count).ToList();
            if (!s.ShuffleQuestions) picked = picked.OrderBy(p => p.Id).ToList();
            var layout = picked.Select(p =>
            {
                var n = (JsonSerializer.Deserialize<string[]>(p.OptionsJson) ?? []).Length;
                var order = Enumerable.Range(0, n).ToArray();
                if (s.ShuffleAnswers) QuizRules.Shuffle(order);
                return new LayoutItem(p.Id, order);
            }).ToList();
            if (open is not null) db.QuizAttempts.Remove(open);
            open = new QuizAttempt { ActivityId = c.QuizId, UserId = user.UserId, LayoutJson = JsonSerializer.Serialize(layout, QuizRules.Json), MaxScore = layout.Count };
            db.QuizAttempts.Add(open);
            await db.SaveChangesAsync(ct);
        }
        return new { id = open.Id, userId = open.UserId, startedAt = open.StartedAt, finishedAt = (DateTime?)null, answers = new Dictionary<string, int>(), score = (int?)null, maxScore = open.MaxScore, questions = await QuizRules.PaperAsync(db, open, ct) };
    }
}

/// Answers are keyed by question id and give the index of the option as displayed to the student.
public record FinishQuizAttemptCommand(int AttemptId, Dictionary<string, int> Answers) : IRequest<object>;

public class FinishQuizAttemptHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<FinishQuizAttemptCommand, object>
{
    public async Task<object> Handle(FinishQuizAttemptCommand c, CancellationToken ct)
    {
        var a = await db.QuizAttempts.FindAsync([c.AttemptId], ct) ?? throw new NotFoundException("Attempt not found");
        if (a.UserId != user.UserId) throw new ForbiddenAccessException();
        if (a.FinishedAt is not null) return new { score = a.Score ?? 0, maxScore = a.MaxScore };
        var (s, _) = await QuizRules.LoadAsync(db, a.ActivityId, ct);
        var layout = QuizRules.Layout(a);
        var ids = layout.Select(l => l.QuestionId).ToList();
        var correct = await db.Questions.AsNoTracking().Where(q => ids.Contains(q.Id)).ToDictionaryAsync(q => q.Id, q => q.CorrectIndex, ct);
        var stored = new Dictionary<string, int>();
        var score = 0;
        foreach (var item in layout)
        {
            if (!c.Answers.TryGetValue(item.QuestionId.ToString(), out var shown) || shown < 0 || shown >= item.Order.Length) continue;
            var original = item.Order[shown];
            stored[item.QuestionId.ToString()] = original;
            if (correct.TryGetValue(item.QuestionId, out var right) && right == original) score++;
        }
        var deadline = a.StartedAt.AddMinutes(s.TimeLimitMins + 1);
        a.FinishedAt = DateTime.UtcNow > deadline ? deadline : DateTime.UtcNow;
        a.AnswersJson = JsonSerializer.Serialize(stored);
        a.Score = score;
        a.MaxScore = layout.Count;
        await db.SaveChangesAsync(ct);
        return new { score, maxScore = a.MaxScore };
    }
}

/// Full review of one attempt; correct answers are only included once the student may review it.
public record GetAttemptReviewQuery(int AttemptId) : IRequest<object>;

public class GetAttemptReviewHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<GetAttemptReviewQuery, object>
{
    public async Task<object> Handle(GetAttemptReviewQuery q, CancellationToken ct)
    {
        var a = await db.QuizAttempts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.AttemptId, ct) ?? throw new NotFoundException("Attempt not found");
        var (s, courseId) = await QuizRules.LoadAsync(db, a.ActivityId, ct);
        if (a.UserId != user.UserId) { user.RequireTeacher(); await UpdateActivityHandler.EnsureTeachesAsync(db, user, courseId, ct); }
        else if (a.FinishedAt is null) throw new BusinessRuleException("Finish the attempt before reviewing it.");
        else if (!s.ReviewAfterClose) throw new ForbiddenAccessException("Review is not permitted for this quiz.");
        var answers = JsonSerializer.Deserialize<Dictionary<string, int>>(a.AnswersJson) ?? [];
        var layout = QuizRules.Layout(a);
        var ids = layout.Select(l => l.QuestionId).ToList();
        var qs = await db.Questions.AsNoTracking().Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        return new
        {
            id = a.Id, startedAt = a.StartedAt, finishedAt = a.FinishedAt, score = a.Score, maxScore = a.MaxScore,
            questions = layout.Where(l => qs.ContainsKey(l.QuestionId)).Select(l =>
            {
                var question = qs[l.QuestionId];
                var opts = QuizRules.Options(question);
                answers.TryGetValue(l.QuestionId.ToString(), out var chosen);
                var answered = answers.ContainsKey(l.QuestionId.ToString());
                return new { id = question.Id, text = question.Text, options = l.Order.Select(i => opts[i]).ToArray(), chosen = answered ? Array.IndexOf(l.Order, chosen) : -1, correct = Array.IndexOf(l.Order, question.CorrectIndex), explanation = question.Explanation };
            }),
        };
    }
}

/// Every finished attempt for a quiz with the questions they used, for lecturer analytics.
public record GetQuizItemDataQuery(int QuizId) : IRequest<object>;

public class GetQuizItemDataHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<GetQuizItemDataQuery, object>
{
    public async Task<object> Handle(GetQuizItemDataQuery q, CancellationToken ct)
    {
        user.RequireTeacher();
        var (_, courseId) = await QuizRules.LoadAsync(db, q.QuizId, ct);
        await UpdateActivityHandler.EnsureTeachesAsync(db, user, courseId, ct);
        var attempts = await db.QuizAttempts.AsNoTracking().Where(a => a.ActivityId == q.QuizId && a.FinishedAt != null && a.LayoutJson != null).ToListAsync(ct);
        var ids = attempts.SelectMany(a => QuizRules.Layout(a).Select(l => l.QuestionId)).Distinct().ToList();
        var questions = await db.Questions.AsNoTracking().Where(x => ids.Contains(x.Id)).ToListAsync(ct);
        return new
        {
            questions = questions.Select(x => new { id = x.Id, text = x.Text, category = x.Category, options = QuizRules.Options(x), correctIndex = x.CorrectIndex }),
            attempts = attempts.Select(a => new { id = a.Id, userId = a.UserId, score = a.Score, maxScore = a.MaxScore, questionIds = QuizRules.Layout(a).Select(l => l.QuestionId), answers = JsonSerializer.Deserialize<Dictionary<string, int>>(a.AnswersJson) ?? [] }),
        };
    }
}
