export type ApiErrorCode =
  | "rate_limited"
  | "not_found"
  | "bad_request"
  | "upstream_error"
  | "invalid_response"
  | "network";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  rate_limited: 429,
  not_found: 404,
  bad_request: 400,
  upstream_error: 502,
  invalid_response: 502,
  network: 503,
};

const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  rate_limited:
    "We're asking the market data provider for too much too fast. Try again shortly.",
  not_found: "We couldn't find that.",
  bad_request: "That request wasn't valid.",
  upstream_error: "The market data provider is having trouble right now.",
  invalid_response: "The market data provider sent something we didn't understand.",
  network: "Couldn't reach the server. Check your connection.",
};

/** Shape of the JSON body every /api route returns on failure. */
export type ApiErrorBody = {
  error: { code: ApiErrorCode; message: string; retryAfter?: number };
};

/**
 * One error type for the whole data path. It's thrown by the server fetcher,
 * serialized by route handlers, and rebuilt by the client, so UI code can
 * branch on `code` instead of parsing strings or status numbers.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Seconds the upstream asked us to wait (rate limiting), if known. */
  readonly retryAfter?: number;

  constructor(code: ApiErrorCode, message?: string, options?: { retryAfter?: number }) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.retryAfter = options?.retryAfter;
  }

  /** Worth automatically retrying? Bad requests and missing things never fix themselves. */
  get retryable() {
    return this.code !== "not_found" && this.code !== "bad_request";
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.retryAfter !== undefined && { retryAfter: this.retryAfter }),
      },
    };
  }

  static fromBody(body: unknown): ApiError | null {
    if (typeof body !== "object" || body === null || !("error" in body)) return null;
    const err = (body as { error?: Partial<ApiErrorBody["error"]> }).error;
    if (!err || typeof err.code !== "string" || !(err.code in STATUS_BY_CODE))
      return null;
    return new ApiError(err.code as ApiErrorCode, err.message, {
      retryAfter: err.retryAfter,
    });
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
