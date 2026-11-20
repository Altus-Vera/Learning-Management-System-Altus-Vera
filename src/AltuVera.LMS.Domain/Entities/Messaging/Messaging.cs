using AltuVera.LMS.Domain.Common;

namespace AltuVera.LMS.Domain.Entities.Messaging;

public class Conversation : BaseEntity
{
    public string Type { get; set; } = "private";
    public string Name { get; set; } = string.Empty;
    public List<ConversationMember> Members { get; set; } = [];
    public List<Message> Messages { get; set; } = [];
}

public class ConversationMember : BaseEntity
{
    public int ConversationId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public bool Starred { get; set; }
    public bool Muted { get; set; }
    public int Unread { get; set; }
    public bool Deleted { get; set; }
}

public class Message : BaseEntity
{
    public int ConversationId { get; set; }
    public string FromId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public DateTime At { get; set; } = DateTime.UtcNow;
}

public class MessageDeletion : BaseEntity
{
    public int MessageId { get; set; }
    public string UserId { get; set; } = string.Empty;
}

public class ContactLink : BaseEntity
{
    public string RequesterId { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public bool Accepted { get; set; }
}

public class UserBlock : BaseEntity
{
    public string UserId { get; set; } = string.Empty;
    public string BlockedId { get; set; } = string.Empty;
}

public class Notification : BaseEntity
{
    public string UserId { get; set; } = string.Empty;
    public string Component { get; set; } = "System";
    public string Subject { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Link { get; set; } = "/dashboard";
    public DateTime At { get; set; } = DateTime.UtcNow;
    public bool Read { get; set; }
}
