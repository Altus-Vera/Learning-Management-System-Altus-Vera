using System.Net;
using System.Text.Json;
using AltuVera.LMS.Application.Common.Exceptions;

namespace AltuVera.LMS.API.Middleware;

public class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            var (status, message) = ex switch
            {
                ForbiddenAccessException => (HttpStatusCode.Forbidden, ex.Message),
                NotFoundException or KeyNotFoundException => (HttpStatusCode.NotFound, ex.Message),
                BusinessRuleException => (HttpStatusCode.BadRequest, ex.Message),
                _ => (HttpStatusCode.InternalServerError, "An unexpected error occurred."),
            };
            if (status == HttpStatusCode.InternalServerError) logger.LogError(ex, "Unhandled exception");
            context.Response.StatusCode = (int)status;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new { error = message }));
        }
    }
}
