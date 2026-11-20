using AltuVera.LMS.Domain.Common;

namespace AltuVera.LMS.Domain.Entities.Registrar;

public class Payment : BaseEntity
{
    public int CourseId { get; set; }
    public string StudentId { get; set; } = string.Empty;
    public decimal Amount { get; set; } = 45000;
    public bool Paid { get; set; }
    public DateTime DueDate { get; set; }
    public DateTime? PaidAt { get; set; }
    public string Reference { get; set; } = string.Empty;
}

public class AccessBlock : BaseEntity
{
    public string StudentId { get; set; } = string.Empty;
    public int? CourseId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string BlockedBy { get; set; } = string.Empty;
    public DateTime At { get; set; } = DateTime.UtcNow;
}

public class SubmissionExtension : BaseEntity
{
    public int ActivityId { get; set; }
    public string StudentId { get; set; } = string.Empty;
    public DateTime Until { get; set; }
}

public class GradeOverride : BaseEntity
{
    public int ActivityId { get; set; }
    public string StudentId { get; set; } = string.Empty;
    public string OverriddenBy { get; set; } = string.Empty;
    public string Previous { get; set; } = string.Empty;
    public DateTime At { get; set; } = DateTime.UtcNow;
}

public class AuditLog : BaseEntity
{
    public DateTime At { get; set; } = DateTime.UtcNow;
    public string Actor { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public string Target { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
}

public class SystemSetting : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
