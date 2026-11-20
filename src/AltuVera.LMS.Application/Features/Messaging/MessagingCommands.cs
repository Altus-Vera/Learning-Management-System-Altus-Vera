using System.Text.Json;
using AltuVera.LMS.Application.Common.Exceptions;
using AltuVera.LMS.Application.Common.Interfaces;
using AltuVera.LMS.Domain.Entities.Messaging;
using AltuVera.LMS.Domain.Entities.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.LMS.Application.Features.Messaging;

// ── Conversations ────────────────────────────────────────────────────────────

public record StartPrivateConversationCommand(string OtherUserId) : IRequest<int>;

public class StartPrivateConversationHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<StartPrivateConversationCommand, int>
{
    public async Task<int> Handle(StartPrivateConversationCommand c, CancellationToken ct)
    {
        if (c.OtherUserId == user.UserId) throw new BusinessRuleException("You cannot message yourself.");
        if (!await db.Users.AnyAsync(u => u.Id == c.OtherUserId, ct)) throw new NotFoundException("User not found");
        var existing = await db.Conversations.Include(x => x.Members)
            .Where(x => x.Type == "private" && x.Members.Any(m => m.UserId == user.UserId) && x.Members.Any(m => m.UserId == c.OtherUserId))
            .FirstOrDefaultAsync(ct);
        if (existing is not null)
        {
            var mine = existing.Members.First(m => m.UserId == user.UserId);
            if (mine.Deleted) { mine.Deleted = false; await db.SaveChangesAsync(ct); }
            return existing.Id;
        }
        var conv = new Conversation { Type = "private", Members = [new() { UserId = user.UserId }, new() { UserId = c.OtherUserId }] };
        db.Conversations.Add(conv);
        await db.SaveChangesAsync(ct);
        return conv.Id;
    }
}

public record SendMessageCommand(int ConversationId, string Text) : IRequest<int>;

public class SendMessageHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<SendMessageCommand, int>
{
    public async Task<int> Handle(SendMessageCommand c, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(c.Text)) throw new BusinessRuleException("Message cannot be empty.");
        var conv = await db.Conversations.Include(x => x.Members).FirstOrDefaultAsync(x => x.Id == c.ConversationId, ct) ?? throw new NotFoundException("Conversation not found");
        if (!conv.Members.Any(m => m.UserId == user.UserId)) throw new ForbiddenAccessException();
        var others = conv.Members.Where(m => m.UserId != user.UserId).ToList();
        if (conv.Type == "private")
        {
            var other = others.First().UserId;
            if (await db.UserBlocks.AnyAsync(b => (b.UserId == user.UserId && b.BlockedId == other) || (b.UserId == other && b.BlockedId == user.UserId), ct))
                throw new BusinessRuleException("You are unable to message this user.");
            var privacy = await db.UserPreferences.AsNoTracking().Where(p => p.UserId == other).Select(p => p.Json).FirstOrDefaultAsync(ct);
            if (privacy is not null && privacy.Contains("\"privacy\":\"contacts\"") && !user.IsTeacher &&
                !await db.ContactLinks.AnyAsync(l => l.Accepted && ((l.RequesterId == user.UserId && l.TargetId == other) || (l.RequesterId == other && l.TargetId == user.UserId)), ct))
                throw new BusinessRuleException("This user only accepts messages from their contacts.");
        }
        var msg = new Message { ConversationId = conv.Id, FromId = user.UserId, Text = c.Text.Trim() };
        db.Messages.Add(msg);
        foreach (var m in others) { m.Unread++; m.Deleted = false; }
        await db.SaveChangesAsync(ct);
        return msg.Id;
    }
}

public record UpdateConversationMemberCommand(int ConversationId, bool? Starred, bool? Muted, bool MarkRead) : IRequest;

public class UpdateConversationMemberHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<UpdateConversationMemberCommand>
{
    public async Task Handle(UpdateConversationMemberCommand c, CancellationToken ct)
    {
        var m = await db.ConversationMembers.FirstOrDefaultAsync(x => x.ConversationId == c.ConversationId && x.UserId == user.UserId, ct) ?? throw new NotFoundException("Conversation not found");
        if (c.Starred is not null) m.Starred = c.Starred.Value;
        if (c.Muted is not null) m.Muted = c.Muted.Value;
        if (c.MarkRead) m.Unread = 0;
        await db.SaveChangesAsync(ct);
    }
}

public record DeleteMessagesCommand(int ConversationId, int[] MessageIds) : IRequest;

public class DeleteMessagesHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<DeleteMessagesCommand>
{
    public async Task Handle(DeleteMessagesCommand c, CancellationToken ct)
    {
        if (!await db.ConversationMembers.AnyAsync(x => x.ConversationId == c.ConversationId && x.UserId == user.UserId, ct)) throw new ForbiddenAccessException();
        var ids = await db.Messages.Where(m => m.ConversationId == c.ConversationId && c.MessageIds.Contains(m.Id)).Select(m => m.Id).ToListAsync(ct);
        var already = await db.MessageDeletions.Where(d => d.UserId == user.UserId && ids.Contains(d.MessageId)).Select(d => d.MessageId).ToListAsync(ct);
        db.MessageDeletions.AddRange(ids.Except(already).Select(id => new MessageDeletion { MessageId = id, UserId = user.UserId }));
        await db.SaveChangesAsync(ct);
    }
}

public record DeleteConversationCommand(int ConversationId) : IRequest;

public class DeleteConversationHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<DeleteConversationCommand>
{
    public async Task Handle(DeleteConversationCommand c, CancellationToken ct)
    {
        var m = await db.ConversationMembers.FirstOrDefaultAsync(x => x.ConversationId == c.ConversationId && x.UserId == user.UserId, ct) ?? throw new NotFoundException("Conversation not found");
        var ids = await db.Messages.Where(x => x.ConversationId == c.ConversationId).Select(x => x.Id).ToListAsync(ct);
        var already = await db.MessageDeletions.Where(d => d.UserId == user.UserId && ids.Contains(d.MessageId)).Select(d => d.MessageId).ToListAsync(ct);
        db.MessageDeletions.AddRange(ids.Except(already).Select(id => new MessageDeletion { MessageId = id, UserId = user.UserId }));
        m.Deleted = true; m.Unread = 0; m.Starred = false;
        await db.SaveChangesAsync(ct);
    }
}

// ── Contacts & blocking ──────────────────────────────────────────────────────

public record ContactActionCommand(string OtherUserId, string Action) : IRequest;

public class ContactActionHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<ContactActionCommand>
{
    public async Task Handle(ContactActionCommand c, CancellationToken ct)
    {
        var me = user.UserId; var other = c.OtherUserId;
        var link = await db.ContactLinks.FirstOrDefaultAsync(l => (l.RequesterId == me && l.TargetId == other) || (l.RequesterId == other && l.TargetId == me), ct);
        switch (c.Action)
        {
            case "request":
                if (link is null)
                {
                    db.ContactLinks.Add(new ContactLink { RequesterId = me, TargetId = other });
                    db.Notifications.Add(new Notification { UserId = other, Component = "System", Subject = $"{user.Name} would like to contact you", Text = $"{user.Name} sent you a contact request. Open Messages → Contacts → Requests to respond.", Link = "/dashboard" });
                }
                break;
            case "accept":
                if (link is null || link.TargetId != me) throw new NotFoundException("Contact request not found");
                link.Accepted = true; break;
            case "decline":
                if (link is not null && !link.Accepted && link.TargetId == me) db.ContactLinks.Remove(link); break;
            case "remove":
                if (link is not null) db.ContactLinks.Remove(link); break;
            case "block":
                if (!await db.UserBlocks.AnyAsync(b => b.UserId == me && b.BlockedId == other, ct)) db.UserBlocks.Add(new UserBlock { UserId = me, BlockedId = other });
                break;
            case "unblock":
                var b = await db.UserBlocks.FirstOrDefaultAsync(x => x.UserId == me && x.BlockedId == other, ct);
                if (b is not null) db.UserBlocks.Remove(b);
                break;
            default: throw new BusinessRuleException("Unknown contact action.");
        }
        await db.SaveChangesAsync(ct);
    }
}

// ── Notifications ────────────────────────────────────────────────────────────

public record MarkNotificationsReadCommand(int? Id) : IRequest;

public class MarkNotificationsReadHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<MarkNotificationsReadCommand>
{
    public async Task Handle(MarkNotificationsReadCommand c, CancellationToken ct)
    {
        var q = db.Notifications.Where(n => n.UserId == user.UserId && !n.Read);
        if (c.Id is not null) q = q.Where(n => n.Id == c.Id);
        foreach (var n in await q.ToListAsync(ct)) n.Read = true;
        await db.SaveChangesAsync(ct);
    }
}

// ── Preferences ──────────────────────────────────────────────────────────────

public record SavePreferencesCommand(JsonElement Preferences) : IRequest;

public class SavePreferencesHandler(IApplicationDbContext db, ICurrentUserService user) : IRequestHandler<SavePreferencesCommand>
{
    public async Task Handle(SavePreferencesCommand c, CancellationToken ct)
    {
        if (c.Preferences.ValueKind != JsonValueKind.Object) throw new BusinessRuleException("Invalid preferences.");
        var raw = c.Preferences.GetRawText();
        if (raw.Length > 100_000) throw new BusinessRuleException("Preferences are too large.");
        var p = await db.UserPreferences.FirstOrDefaultAsync(x => x.UserId == user.UserId, ct);
        if (p is null) db.UserPreferences.Add(new UserPreference { UserId = user.UserId, Json = raw });
        else p.Json = raw;
        await db.SaveChangesAsync(ct);
    }
}
