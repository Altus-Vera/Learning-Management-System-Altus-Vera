using System.Text.Json;
using AltuVera.LMS.Application.Features.Activities;
using AltuVera.LMS.Application.Features.Assignments;
using AltuVera.LMS.Application.Features.Bootstrap;
using AltuVera.LMS.Application.Features.Courses;
using AltuVera.LMS.Application.Features.Messaging;
using AltuVera.LMS.Application.Features.Registrar;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AltuVera.LMS.API.Controllers.v1;

[Authorize]
[ApiController]
[Route("api/v1")]
public class BootstrapController(IMediator mediator) : ControllerBase
{
    [HttpGet("bootstrap")]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok(await mediator.Send(new BootstrapQuery(), ct));
}

[Authorize]
[ApiController]
[Route("api/v1")]
public class CoursesController(IMediator mediator) : ControllerBase
{
    public record CourseStateBody(bool? Starred, bool? Hidden, bool Touch);
    public record ActivityBody(string? Name, string? Description, string? Content, bool? Visible, JsonElement? Assign, JsonElement? Quiz);
    public record NewActivityBody(string Type, string Name);
    public record EventBody(string Title, DateTime Date, string Type, int? CourseId);

    [HttpPut("courses/{id:int}/state")]
    public async Task<IActionResult> SetState(int id, [FromBody] CourseStateBody b, CancellationToken ct) { await mediator.Send(new SetCourseStateCommand(id, b.Starred, b.Hidden, b.Touch), ct); return NoContent(); }

    [HttpPost("activities/{id:int}/completion")]
    public async Task<IActionResult> ToggleCompletion(int id, CancellationToken ct) { await mediator.Send(new ToggleCompletionCommand(id), ct); return NoContent(); }

    [HttpPut("activities/{id:int}")]
    public async Task<IActionResult> UpdateActivity(int id, [FromBody] ActivityBody b, CancellationToken ct) { await mediator.Send(new UpdateActivityCommand(id, b.Name, b.Description, b.Content, b.Visible, b.Assign, b.Quiz), ct); return NoContent(); }

    [HttpPost("sections/{sectionId:int}/activities")]
    public async Task<IActionResult> AddActivity(int sectionId, [FromBody] NewActivityBody b, CancellationToken ct) => Ok(new { id = await mediator.Send(new AddActivityCommand(sectionId, b.Type, b.Name), ct) });

    [HttpDelete("activities/{id:int}")]
    public async Task<IActionResult> DeleteActivity(int id, CancellationToken ct) { await mediator.Send(new DeleteActivityCommand(id), ct); return NoContent(); }

    [HttpPost("calendar/events")]
    public async Task<IActionResult> AddEvent([FromBody] EventBody b, CancellationToken ct) => Ok(new { id = await mediator.Send(new AddEventCommand(b.Title, b.Date, b.Type, b.CourseId), ct) });

    [HttpDelete("calendar/events/{id:int}")]
    public async Task<IActionResult> DeleteEvent(int id, CancellationToken ct) { await mediator.Send(new DeleteEventCommand(id), ct); return NoContent(); }
}

[Authorize]
[ApiController]
[Route("api/v1")]
public class AssignmentsController(IMediator mediator) : ControllerBase
{
    public record SaveBody(string? OnlineText);
    public record SubmitBody(bool StatementAccepted);
    public record GradeBody(decimal? Grade, string? Feedback);
    public record StatusBody(string Status);
    public record CommentBody(string StudentId, string Text);

    [HttpPost("assignments/{id:int}/files")]
    [RequestSizeLimit(105_000_000)]
    public async Task<IActionResult> Upload(int id, IFormFile file, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        return Ok(await mediator.Send(new UploadSubmissionFileCommand(id, file.FileName, file.Length, stream), ct));
    }

    [HttpDelete("submission-files/{fileId:int}")]
    public async Task<IActionResult> DeleteFile(int fileId, CancellationToken ct) { await mediator.Send(new DeleteSubmissionFileCommand(fileId), ct); return NoContent(); }

    [HttpGet("submission-files/{fileId:int}")]
    public async Task<IActionResult> Download(int fileId, CancellationToken ct)
    {
        var (stream, name) = await mediator.Send(new DownloadSubmissionFileQuery(fileId), ct);
        return File(stream, "application/octet-stream", name);
    }

    [HttpPut("assignments/{id:int}/submission")]
    public async Task<IActionResult> Save(int id, [FromBody] SaveBody b, CancellationToken ct) { await mediator.Send(new SaveSubmissionCommand(id, b.OnlineText), ct); return NoContent(); }

    [HttpPost("assignments/{id:int}/submit")]
    public async Task<IActionResult> Submit(int id, [FromBody] SubmitBody b, CancellationToken ct) { await mediator.Send(new SubmitForGradingCommand(id, b.StatementAccepted), ct); return NoContent(); }

    [HttpDelete("assignments/{id:int}/submission")]
    public async Task<IActionResult> Remove(int id, CancellationToken ct) { await mediator.Send(new RemoveSubmissionCommand(id), ct); return NoContent(); }

    [HttpPut("assignments/{id:int}/submissions/{studentId}/grade")]
    public async Task<IActionResult> Grade(int id, string studentId, [FromBody] GradeBody b, CancellationToken ct) { await mediator.Send(new GradeSubmissionCommand(id, studentId, b.Grade, b.Feedback ?? ""), ct); return NoContent(); }

    [HttpPut("assignments/{id:int}/submissions/{studentId}/status")]
    public async Task<IActionResult> Status(int id, string studentId, [FromBody] StatusBody b, CancellationToken ct) { await mediator.Send(new SetSubmissionStatusCommand(id, studentId, b.Status), ct); return NoContent(); }

    [HttpPost("assignments/{id:int}/comments")]
    public async Task<IActionResult> AddComment(int id, [FromBody] CommentBody b, CancellationToken ct) => Ok(new { id = await mediator.Send(new AddSubmissionCommentCommand(id, b.StudentId, b.Text), ct) });

    [HttpDelete("submission-comments/{commentId:int}")]
    public async Task<IActionResult> DeleteComment(int commentId, CancellationToken ct) { await mediator.Send(new DeleteSubmissionCommentCommand(commentId), ct); return NoContent(); }
}

[Authorize]
[ApiController]
[Route("api/v1")]
public class ActivitiesController(IMediator mediator) : ControllerBase
{
    public record DiscussionBody(string Subject, string Message, bool Pinned);
    public record ReplyBody(int ParentId, string Message);
    public record PostBody(string Message);
    public record FlagsBody(bool? Pinned, bool? Locked);
    public record AnswersBody(Dictionary<string, int> Answers);
    public record JoinBody(int? GroupId);

    [HttpPost("forums/{id:int}/discussions")]
    public async Task<IActionResult> AddDiscussion(int id, [FromBody] DiscussionBody b, CancellationToken ct) => Ok(new { id = await mediator.Send(new AddDiscussionCommand(id, b.Subject, b.Message, b.Pinned), ct) });

    [HttpPost("forums/{id:int}/subscription")]
    public async Task<IActionResult> ToggleSubscription(int id, CancellationToken ct) { await mediator.Send(new ToggleForumSubscriptionCommand(id), ct); return NoContent(); }

    [HttpPost("discussions/{id:int}/posts")]
    public async Task<IActionResult> Reply(int id, [FromBody] ReplyBody b, CancellationToken ct) => Ok(new { id = await mediator.Send(new ReplyCommand(id, b.ParentId, b.Message), ct) });

    [HttpPut("discussions/{id:int}")]
    public async Task<IActionResult> Flags(int id, [FromBody] FlagsBody b, CancellationToken ct) { await mediator.Send(new SetDiscussionFlagsCommand(id, b.Pinned, b.Locked), ct); return NoContent(); }

    [HttpDelete("discussions/{id:int}")]
    public async Task<IActionResult> DeleteDiscussion(int id, CancellationToken ct) { await mediator.Send(new DeleteDiscussionCommand(id), ct); return NoContent(); }

    [HttpPost("discussions/{id:int}/star")]
    public async Task<IActionResult> Star(int id, CancellationToken ct) { await mediator.Send(new ToggleDiscussionStarCommand(id), ct); return NoContent(); }

    [HttpPut("posts/{id:int}")]
    public async Task<IActionResult> EditPost(int id, [FromBody] PostBody b, CancellationToken ct) { await mediator.Send(new EditPostCommand(id, b.Message), ct); return NoContent(); }

    [HttpDelete("posts/{id:int}")]
    public async Task<IActionResult> DeletePost(int id, CancellationToken ct) { await mediator.Send(new DeletePostCommand(id), ct); return NoContent(); }

    [HttpPost("quizzes/{id:int}/attempts")]
    public async Task<IActionResult> StartAttempt(int id, CancellationToken ct) => Ok(await mediator.Send(new StartQuizAttemptCommand(id), ct));

    [HttpPost("quiz-attempts/{id:int}/finish")]
    public async Task<IActionResult> FinishAttempt(int id, [FromBody] AnswersBody b, CancellationToken ct) => Ok(new { score = await mediator.Send(new FinishQuizAttemptCommand(id, b.Answers), ct) });

    [HttpPost("feedback/{id:int}/responses")]
    public async Task<IActionResult> SubmitFeedback(int id, [FromBody] JsonElement answers, CancellationToken ct) { await mediator.Send(new SubmitFeedbackCommand(id, answers), ct); return NoContent(); }

    [HttpPost("choices/{id:int}/join")]
    public async Task<IActionResult> Join(int id, [FromBody] JoinBody b, CancellationToken ct) { await mediator.Send(new JoinChoiceGroupCommand(id, b.GroupId), ct); return NoContent(); }
}

[Authorize]
[ApiController]
[Route("api/v1")]
public class MessagingController(IMediator mediator) : ControllerBase
{
    public record StartBody(string UserId);
    public record MessageBody(string Text);
    public record MemberBody(bool? Starred, bool? Muted, bool MarkRead);
    public record DeleteMessagesBody(int[] MessageIds);

    [HttpPost("conversations")]
    public async Task<IActionResult> Start([FromBody] StartBody b, CancellationToken ct) => Ok(new { id = await mediator.Send(new StartPrivateConversationCommand(b.UserId), ct) });

    [HttpPost("conversations/{id:int}/messages")]
    public async Task<IActionResult> Send(int id, [FromBody] MessageBody b, CancellationToken ct) => Ok(new { id = await mediator.Send(new SendMessageCommand(id, b.Text), ct) });

    [HttpPut("conversations/{id:int}/member")]
    public async Task<IActionResult> Member(int id, [FromBody] MemberBody b, CancellationToken ct) { await mediator.Send(new UpdateConversationMemberCommand(id, b.Starred, b.Muted, b.MarkRead), ct); return NoContent(); }

    [HttpPost("conversations/{id:int}/delete-messages")]
    public async Task<IActionResult> DeleteMessages(int id, [FromBody] DeleteMessagesBody b, CancellationToken ct) { await mediator.Send(new DeleteMessagesCommand(id, b.MessageIds), ct); return NoContent(); }

    [HttpDelete("conversations/{id:int}")]
    public async Task<IActionResult> DeleteConversation(int id, CancellationToken ct) { await mediator.Send(new DeleteConversationCommand(id), ct); return NoContent(); }

    [HttpPost("contacts/{userId}/{op}")]
    public async Task<IActionResult> Contact(string userId, string op, CancellationToken ct) { await mediator.Send(new ContactActionCommand(userId, op), ct); return NoContent(); }

    [HttpPut("notifications/{id:int}/read")]
    public async Task<IActionResult> Read(int id, CancellationToken ct) { await mediator.Send(new MarkNotificationsReadCommand(id), ct); return NoContent(); }

    [HttpPut("notifications/read-all")]
    public async Task<IActionResult> ReadAll(CancellationToken ct) { await mediator.Send(new MarkNotificationsReadCommand(null), ct); return NoContent(); }

    [HttpPut("me/preferences")]
    public async Task<IActionResult> SavePreferences([FromBody] JsonElement prefs, CancellationToken ct) { await mediator.Send(new SavePreferencesCommand(prefs), ct); return NoContent(); }
}

[Authorize]
[ApiController]
[Route("api/v1/analytics")]
public class AnalyticsController(IMediator mediator) : ControllerBase
{
    public record NotifyBody(string StudentId, int CourseId, string Message);

    [HttpGet("at-risk")]
    public async Task<IActionResult> AtRisk([FromQuery] int? courseId, CancellationToken ct) => Ok(await mediator.Send(new Application.Features.Analytics.AtRiskQuery(courseId), ct));

    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct) => Ok(await mediator.Send(new Application.Features.Analytics.MyInsightsQuery(), ct));

    [HttpPost("notify")]
    public async Task<IActionResult> Notify([FromBody] NotifyBody b, CancellationToken ct) { await mediator.Send(new Application.Features.Analytics.NotifyStudentCommand(b.StudentId, b.CourseId, b.Message), ct); return NoContent(); }
}

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/v1/registrar")]
public class RegistrarController(IMediator mediator) : ControllerBase
{
    public record BlockBody(string[] StudentIds, int? CourseId, string Reason);
    public record UnblockBody(string[] StudentIds, int? CourseId, bool All);
    public record PaymentBody(int CourseId, string StudentId, bool Paid);
    public record AutoBlockBody(bool Enabled);
    public record EnrolBody(int CourseId, string[] StudentIds, bool Remove);
    public record LecturerBody(string LecturerId);
    public record OverrideBody(int ActivityId, string StudentId, decimal? Grade, string? Feedback, string Status, DateTime? ExtensionUntil);

    [HttpPost("blocks")]
    public async Task<IActionResult> Block([FromBody] BlockBody b, CancellationToken ct) { await mediator.Send(new BlockStudentsCommand(b.StudentIds, b.CourseId, b.Reason), ct); return NoContent(); }

    [HttpPost("unblocks")]
    public async Task<IActionResult> Unblock([FromBody] UnblockBody b, CancellationToken ct) { await mediator.Send(new UnblockStudentsCommand(b.StudentIds, b.CourseId, b.All), ct); return NoContent(); }

    [HttpPut("payments")]
    public async Task<IActionResult> Payment([FromBody] PaymentBody b, CancellationToken ct) { await mediator.Send(new SetPaymentCommand(b.CourseId, b.StudentId, b.Paid), ct); return NoContent(); }

    [HttpPost("payments/block-unpaid")]
    public async Task<IActionResult> BlockUnpaid(CancellationToken ct) => Ok(new { blocked = await mediator.Send(new BlockAllUnpaidCommand(), ct) });

    [HttpPut("settings/auto-block")]
    public async Task<IActionResult> AutoBlock([FromBody] AutoBlockBody b, CancellationToken ct) { await mediator.Send(new SetAutoBlockCommand(b.Enabled), ct); return NoContent(); }

    [HttpPost("enrolments")]
    public async Task<IActionResult> Enrol([FromBody] EnrolBody b, CancellationToken ct) { await mediator.Send(new EnrolStudentsCommand(b.CourseId, b.StudentIds, b.Remove), ct); return NoContent(); }

    [HttpPut("courses/{id:int}/lecturer")]
    public async Task<IActionResult> Lecturer(int id, [FromBody] LecturerBody b, CancellationToken ct) { await mediator.Send(new SetCourseLecturerCommand(id, b.LecturerId), ct); return NoContent(); }

    [HttpPut("submissions")]
    public async Task<IActionResult> Override([FromBody] OverrideBody b, CancellationToken ct) { await mediator.Send(new OverrideSubmissionCommand(b.ActivityId, b.StudentId, b.Grade, b.Feedback ?? "", b.Status, b.ExtensionUntil), ct); return NoContent(); }
}
