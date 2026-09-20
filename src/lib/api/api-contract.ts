export interface ApiSuccessResponse<T> {
  data: T;
  error: null;
  meta: Record<string, unknown>;
}

export interface ApiErrorResponse {
  data: null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: Record<string, unknown>;
}

export function successResponse<T>(
  data: T,
  meta: Record<string, unknown> = {}
): ApiSuccessResponse<T> {
  return { data, error: null, meta };
}

export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  return {
    data: null,
    error: { code, message, ...(details ? { details } : {}) },
    meta: {},
  };
}

const STATUS_MAP: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }

  toResponse(): Response {
    const status = STATUS_MAP[this.code] || 500;
    const body = {
      data: null,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
      meta: {},
    };
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
