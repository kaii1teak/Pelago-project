import { ApiError, type ApiErrorCode } from "./errors";

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: "bad_request",
  404: "not_found",
  429: "rate_limited",
};

/**
 * Browser-side GET against our own /api routes (never CoinGecko directly).
 * Failures always surface as `ApiError` so callers handle one error type.
 */
export async function apiGet<T>(
  path: string,
  init?: { signal?: AbortSignal },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      signal: init?.signal,
      headers: { accept: "application/json" },
    });
  } catch (error) {
    // Aborts are intentional (unmount/navigation). Let TanStack Query handle them.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("network");
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw (
      ApiError.fromBody(body) ??
      new ApiError(CODE_BY_STATUS[res.status] ?? "upstream_error")
    );
  }

  return (await res.json()) as T;
}
