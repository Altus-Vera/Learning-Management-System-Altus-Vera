using AltuVera.LMS.Domain.Entities.Academics;
using AltuVera.LMS.Domain.Entities.Assessment;
using AltuVera.LMS.Domain.Entities.Forums;
using AltuVera.LMS.Domain.Entities.Messaging;
using AltuVera.LMS.Domain.Entities.Registrar;
using AltuVera.LMS.Domain.Entities.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AltuVera.LMS.Infrastructure.Data.Configurations;

public class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> b)
    {
        b.Property(x => x.IndexNo).HasMaxLength(40);
        b.Property(x => x.BatchCode).HasMaxLength(20);
        b.Property(x => x.Phone).HasMaxLength(30);
        b.Ignore(x => x.FullName);
    }
}

public class UserPreferenceConfiguration : IEntityTypeConfiguration<UserPreference>
{
    public void Configure(EntityTypeBuilder<UserPreference> b) => b.HasIndex(x => x.UserId).IsUnique();
}

public class BatchConfiguration : IEntityTypeConfiguration<Batch>
{
    public void Configure(EntityTypeBuilder<Batch> b) { b.HasIndex(x => x.Code).IsUnique(); b.Property(x => x.Code).HasMaxLength(20); b.Property(x => x.Name).HasMaxLength(200); }
}

public class CourseConfiguration : IEntityTypeConfiguration<Course>
{
    public void Configure(EntityTypeBuilder<Course> b)
    {
        b.Property(x => x.ShortName).HasMaxLength(30);
        b.Property(x => x.FullName).HasMaxLength(200);
        b.Property(x => x.Color).HasMaxLength(20);
        b.HasMany(x => x.Sections).WithOne().HasForeignKey(s => s.CourseId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CourseSectionConfiguration : IEntityTypeConfiguration<CourseSection>
{
    public void Configure(EntityTypeBuilder<CourseSection> b) =>
        b.HasMany(x => x.Activities).WithOne(a => a.Section).HasForeignKey(a => a.SectionId).OnDelete(DeleteBehavior.Cascade);
}

public class ActivityConfiguration : IEntityTypeConfiguration<Activity>
{
    public void Configure(EntityTypeBuilder<Activity> b) { b.Property(x => x.Type).HasMaxLength(20); b.Property(x => x.Name).HasMaxLength(255); }
}

public class EnrolmentConfiguration : IEntityTypeConfiguration<Enrolment>
{
    public void Configure(EntityTypeBuilder<Enrolment> b) => b.HasIndex(x => new { x.CourseId, x.UserId }).IsUnique();
}

public class CourseUserStateConfiguration : IEntityTypeConfiguration<CourseUserState>
{
    public void Configure(EntityTypeBuilder<CourseUserState> b) => b.HasIndex(x => new { x.CourseId, x.UserId }).IsUnique();
}

public class ActivityCompletionConfiguration : IEntityTypeConfiguration<ActivityCompletion>
{
    public void Configure(EntityTypeBuilder<ActivityCompletion> b) => b.HasIndex(x => new { x.ActivityId, x.UserId }).IsUnique();
}

public class SubmissionConfiguration : IEntityTypeConfiguration<Submission>
{
    public void Configure(EntityTypeBuilder<Submission> b)
    {
        b.HasIndex(x => new { x.ActivityId, x.StudentId }).IsUnique();
        b.Property(x => x.Grade).HasPrecision(6, 2);
        b.Property(x => x.Status).HasMaxLength(20);
        b.HasMany(x => x.Files).WithOne().HasForeignKey(f => f.SubmissionId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ChoiceGroupConfiguration : IEntityTypeConfiguration<ChoiceGroup>
{
    public void Configure(EntityTypeBuilder<ChoiceGroup> b) =>
        b.HasMany(x => x.Members).WithOne().HasForeignKey(m => m.GroupId).OnDelete(DeleteBehavior.Cascade);
}

public class ForumDiscussionConfiguration : IEntityTypeConfiguration<ForumDiscussion>
{
    public void Configure(EntityTypeBuilder<ForumDiscussion> b)
    {
        b.Property(x => x.Subject).HasMaxLength(255);
        b.HasMany(x => x.Posts).WithOne().HasForeignKey(p => p.DiscussionId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ConversationConfiguration : IEntityTypeConfiguration<Conversation>
{
    public void Configure(EntityTypeBuilder<Conversation> b)
    {
        b.HasMany(x => x.Members).WithOne().HasForeignKey(m => m.ConversationId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Messages).WithOne().HasForeignKey(m => m.ConversationId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b) => b.HasIndex(x => x.UserId);
}

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b) { b.HasIndex(x => new { x.CourseId, x.StudentId }).IsUnique(); b.Property(x => x.Amount).HasPrecision(12, 2); }
}

public class SubmissionExtensionConfiguration : IEntityTypeConfiguration<SubmissionExtension>
{
    public void Configure(EntityTypeBuilder<SubmissionExtension> b) => b.HasIndex(x => new { x.ActivityId, x.StudentId }).IsUnique();
}

public class GradeOverrideConfiguration : IEntityTypeConfiguration<GradeOverride>
{
    public void Configure(EntityTypeBuilder<GradeOverride> b) => b.HasIndex(x => new { x.ActivityId, x.StudentId }).IsUnique();
}

public class SystemSettingConfiguration : IEntityTypeConfiguration<SystemSetting>
{
    public void Configure(EntityTypeBuilder<SystemSetting> b) => b.HasIndex(x => x.Key).IsUnique();
}
