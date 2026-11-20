using AltuVera.LMS.Domain.Entities.Academics;
using AltuVera.LMS.Domain.Entities.Assessment;
using AltuVera.LMS.Domain.Entities.Forums;
using AltuVera.LMS.Domain.Entities.Messaging;
using AltuVera.LMS.Domain.Entities.Registrar;
using AltuVera.LMS.Domain.Entities.Users;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.LMS.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    // Users
    DbSet<AppUser> Users { get; }
    DbSet<Microsoft.AspNetCore.Identity.IdentityRole> Roles { get; }
    DbSet<Microsoft.AspNetCore.Identity.IdentityUserRole<string>> UserRoles { get; }
    DbSet<UserPreference> UserPreferences { get; }

    // Academics
    DbSet<Batch> Batches { get; }
    DbSet<Course> Courses { get; }
    DbSet<CourseSection> CourseSections { get; }
    DbSet<Activity> Activities { get; }
    DbSet<Enrolment> Enrolments { get; }
    DbSet<CourseUserState> CourseUserStates { get; }
    DbSet<ActivityCompletion> ActivityCompletions { get; }
    DbSet<CalendarEvent> CalendarEvents { get; }

    // Assessment
    DbSet<Submission> Submissions { get; }
    DbSet<SubmissionFile> SubmissionFiles { get; }
    DbSet<SubmissionComment> SubmissionComments { get; }
    DbSet<QuizAttempt> QuizAttempts { get; }
    DbSet<FeedbackResponse> FeedbackResponses { get; }
    DbSet<ChoiceGroup> ChoiceGroups { get; }
    DbSet<ChoiceGroupMember> ChoiceGroupMembers { get; }

    // Forums
    DbSet<ForumDiscussion> ForumDiscussions { get; }
    DbSet<ForumPost> ForumPosts { get; }
    DbSet<ForumSubscription> ForumSubscriptions { get; }
    DbSet<DiscussionStar> DiscussionStars { get; }

    // Messaging
    DbSet<Conversation> Conversations { get; }
    DbSet<ConversationMember> ConversationMembers { get; }
    DbSet<Message> Messages { get; }
    DbSet<MessageDeletion> MessageDeletions { get; }
    DbSet<ContactLink> ContactLinks { get; }
    DbSet<UserBlock> UserBlocks { get; }
    DbSet<Notification> Notifications { get; }

    // Registrar
    DbSet<Payment> Payments { get; }
    DbSet<AccessBlock> AccessBlocks { get; }
    DbSet<SubmissionExtension> SubmissionExtensions { get; }
    DbSet<GradeOverride> GradeOverrides { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<SystemSetting> SystemSettings { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
