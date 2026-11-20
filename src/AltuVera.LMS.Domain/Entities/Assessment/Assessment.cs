using AltuVera.LMS.Domain.Common;

namespace AltuVera.LMS.Domain.Entities.Assessment;

public class Submission : BaseEntity
{
    public int ActivityId { get; set; }
    public string StudentId { get; set; } = string.Empty;
    public string Status { get; set; } = "new";
    public string OnlineText { get; set; } = string.Empty;
    public DateTime? ModifiedAt { get; set; }
    public decimal? Grade { get; set; }
    public string Feedback { get; set; } = string.Empty;
    public DateTime? GradedAt { get; set; }
    public List<SubmissionFile> Files { get; set; } = [];
}

public class SubmissionFile : BaseEntity
{
    public int SubmissionId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredName { get; set; } = string.Empty;
    public long Size { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}

public class SubmissionComment : BaseEntity
{
    public int ActivityId { get; set; }
    public string StudentId { get; set; } = string.Empty;
    public string AuthorId { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public DateTime At { get; set; } = DateTime.UtcNow;
}

public class QuizAttempt : BaseEntity
{
    public int ActivityId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }
    public string AnswersJson { get; set; } = "{}";
    public int? Score { get; set; }
}

public class FeedbackResponse : BaseEntity
{
    public int ActivityId { get; set; }
    public string? UserId { get; set; }
    public string AnswersJson { get; set; } = "{}";
    public DateTime At { get; set; } = DateTime.UtcNow;
}

public class ChoiceGroup : BaseEntity
{
    public int ActivityId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int Capacity { get; set; } = 5;
    public List<ChoiceGroupMember> Members { get; set; } = [];
}

public class ChoiceGroupMember : BaseEntity
{
    public int GroupId { get; set; }
    public string? UserId { get; set; }
    public string MemberName { get; set; } = string.Empty;
}
