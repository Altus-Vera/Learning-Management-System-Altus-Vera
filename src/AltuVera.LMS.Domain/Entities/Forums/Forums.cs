using AltuVera.LMS.Domain.Common;

namespace AltuVera.LMS.Domain.Entities.Forums;

public class ForumDiscussion : BaseEntity
{
    public int ActivityId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string AuthorId { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool Pinned { get; set; }
    public bool Locked { get; set; }
    public List<ForumPost> Posts { get; set; } = [];
}

public class ForumPost : BaseEntity
{
    public int DiscussionId { get; set; }
    public int? ParentId { get; set; }
    public string AuthorId { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime At { get; set; } = DateTime.UtcNow;
}

public class ForumSubscription : BaseEntity
{
    public int ActivityId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public bool Subscribed { get; set; }
}

public class DiscussionStar : BaseEntity
{
    public int DiscussionId { get; set; }
    public string UserId { get; set; } = string.Empty;
}
