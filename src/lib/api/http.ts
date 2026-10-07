import { NextResponse } from "next/server";
import { ApiError } from "./errors";

/**
 * Success response with CDN caching. `s-maxage` lets Vercel's edge serve one
 * upstream result to many visitors; `stale-while-revalidate` keeps responses
 * instant while the edge refreshes in the background.
 */
export function jsonResponse<T>(
  data: T,
  { sMaxAge, stale = false }: { sMaxAge: number; stale?: boolean },
) {
  return NextResponse.json(data, {
    headers: stale
      ? // Serving a fallback: don't let the CDN pin it for long.
        { "Cache-Control": "public, s-maxage=10", "X-Data-Stale": "1" }
      : {
          "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 5}`,
        },
  });
}

/** Map anything thrown inside a route handler to the shared error body. */
export function errorResponse(error: unknown) {
  const apiError =
    error instanceof ApiError
      ? error
      : (console.error("[api] unexpected error", error), new ApiError("upstream_error"));

  return NextResponse.json(apiError.toBody(), {
    status: apiError.status,
    headers: {
      "Cache-Control": "no-store",
      ...(apiError.retryAfter !== undefined && {
        "Retry-After": String(apiError.retryAfter),
      }),
    },
  });
}
