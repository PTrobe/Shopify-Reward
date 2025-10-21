export class LoyaltyAppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'LoyaltyAppError';
  }
}

export class ValidationError extends LoyaltyAppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends LoyaltyAppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends LoyaltyAppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class InsufficientPointsError extends LoyaltyAppError {
  constructor(required: number, available: number) {
    super(`Insufficient points. Required: ${required}, Available: ${available}`, 400, 'INSUFFICIENT_POINTS');
    this.statusCode = 400;
  }
}

export class RewardUnavailableError extends LoyaltyAppError {
  constructor(reason: string) {
    super(`Reward unavailable: ${reason}`, 400, 'REWARD_UNAVAILABLE');
  }
}

export class RateLimitError extends LoyaltyAppError {
  constructor() {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
  }
}

// Error response formatter for APIs
export function formatErrorResponse(error: Error) {
  if (error instanceof LoyaltyAppError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
      statusCode: error.statusCode,
    };
  }

  // Log unknown errors for debugging
  console.error('Unknown error:', error);

  return {
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
    statusCode: 500,
  };
}

// Async error handler wrapper
export function handleAsyncError<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const formatted = formatErrorResponse(error as Error);
      throw new LoyaltyAppError(
        formatted.error.message,
        formatted.statusCode,
        formatted.error.code
      );
    }
  };
}