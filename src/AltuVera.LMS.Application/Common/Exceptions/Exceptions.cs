namespace AltuVera.LMS.Application.Common.Exceptions;

public class ForbiddenAccessException(string message = "You do not have permission to perform this action.") : Exception(message);

public class NotFoundException(string message) : Exception(message);

public class BusinessRuleException(string message) : Exception(message);
