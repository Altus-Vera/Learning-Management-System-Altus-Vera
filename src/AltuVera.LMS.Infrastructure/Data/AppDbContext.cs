using AltuVera.LMS.Application.Common.Interfaces;
using AltuVera.LMS.Domain.Entities.Academics;
using AltuVera.LMS.Domain.Entities.Assessment;
using AltuVera.LMS.Domain.Entities.Forums;
using AltuVera.LMS.Domain.Entities.Messaging;
using AltuVera.LMS.Domain.Entities.Registrar;
using AltuVera.LMS.Domain.Entities.Users;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AltuVera.LMS.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser>(options), IApplicationDbContext
{
    public DbSet<UserPreference> UserPreferences => Set<UserPreference>();

    public DbSet<Batch> Batches => Set<Batch>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<CourseSection> CourseSections => Set<CourseSection>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Enrolment> Enrolments => Set<Enrolment>();
    public DbSet<CourseUserState> CourseUserStates => Set<CourseUserState>();
    public DbSet<ActivityCompletion> ActivityCompletions => Set<ActivityCompletion>();
    public DbSet<CalendarEvent> CalendarEvents => Set<CalendarEvent>();

    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<SubmissionFile> SubmissionFiles => Set<SubmissionFile>();
    public DbSet<SubmissionComment> SubmissionComments => Set<SubmissionComment>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();
    public DbSet<FeedbackResponse> FeedbackResponses => Set<FeedbackResponse>();
    public DbSet<ChoiceGroup> ChoiceGroups => Set<ChoiceGroup>();
    public DbSet<ChoiceGroupMember> ChoiceGroupMembers => Set<ChoiceGroupMember>();

    public DbSet<ForumDiscussion> ForumDiscussions => Set<ForumDiscussion>();
    public DbSet<ForumPost> ForumPosts => Set<ForumPost>();
    public DbSet<ForumSubscription> ForumSubscriptions => Set<ForumSubscription>();
    public DbSet<DiscussionStar> DiscussionStars => Set<DiscussionStar>();

    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<ConversationMember> ConversationMembers => Set<ConversationMember>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<MessageDeletion> MessageDeletions => Set<MessageDeletion>();
    public DbSet<ContactLink> ContactLinks => Set<ContactLink>();
    public DbSet<UserBlock> UserBlocks => Set<UserBlock>();
    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<AccessBlock> AccessBlocks => Set<AccessBlock>();
    public DbSet<SubmissionExtension> SubmissionExtensions => Set<SubmissionExtension>();
    public DbSet<GradeOverride> GradeOverrides => Set<GradeOverride>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // SQL Server drops DateTimeKind; every timestamp is stored in UTC, so mark it as UTC when read.
        var utc = new ValueConverter<DateTime, DateTime>(v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(), v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
        var utcNullable = new ValueConverter<DateTime?, DateTime?>(v => v == null ? v : v.Value.Kind == DateTimeKind.Utc ? v : v.Value.ToUniversalTime(), v => v == null ? v : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc));
        foreach (var entity in builder.Model.GetEntityTypes())
            foreach (var p in entity.GetProperties())
            {
                if (p.ClrType == typeof(DateTime)) p.SetValueConverter(utc);
                else if (p.ClrType == typeof(DateTime?)) p.SetValueConverter(utcNullable);
            }
    }
}
