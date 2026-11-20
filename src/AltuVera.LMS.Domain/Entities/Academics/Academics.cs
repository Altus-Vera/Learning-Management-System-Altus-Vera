using AltuVera.LMS.Domain.Common;

namespace AltuVera.LMS.Domain.Entities.Academics;

public class Batch : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Programme { get; set; } = string.Empty;
    public string Intake { get; set; } = string.Empty;
    public int Year { get; set; }
    public int Semester { get; set; }
}

public class Course : BaseEntity
{
    public string ShortName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Term { get; set; } = string.Empty;
    public string Color { get; set; } = "#0033A0";
    public string LecturerName { get; set; } = string.Empty;
    public string? LecturerId { get; set; }
    public List<CourseSection> Sections { get; set; } = [];
}

public class CourseSection : BaseEntity
{
    public int CourseId { get; set; }
    public int SortOrder { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public List<Activity> Activities { get; set; } = [];
}

public class Activity : BaseEntity
{
    public int SectionId { get; set; }
    public CourseSection? Section { get; set; }
    public int SortOrder { get; set; }
    public string Type { get; set; } = "resource";
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Content { get; set; }
    public bool Visible { get; set; } = true;
    public string? AssignJson { get; set; }
    public string? QuizJson { get; set; }
}

public class Enrolment : BaseEntity
{
    public int CourseId { get; set; }
    public string UserId { get; set; } = string.Empty;
}

public class CourseUserState : BaseEntity
{
    public int CourseId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public bool Starred { get; set; }
    public bool Hidden { get; set; }
    public DateTime LastAccess { get; set; } = DateTime.UtcNow;
}

public class ActivityCompletion : BaseEntity
{
    public int ActivityId { get; set; }
    public string UserId { get; set; } = string.Empty;
}

public class CalendarEvent : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string Type { get; set; } = "user";
    public int? CourseId { get; set; }
    public string? UserId { get; set; }
}
