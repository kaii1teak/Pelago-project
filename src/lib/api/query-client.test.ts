import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { retryDelay, shouldRetry } from "./query-client";

describe("shouldRetry", () => {
  it("retries transient failures a couple of times, then stops", () => {
    const error = new ApiError("upstream_error");
    expect(shouldRetry(0, error)).toBe(true);
    expect(shouldRetry(1, error)).toBe(true);
    expect(shouldRetry(2, error)).toBe(false);
  });

  it("retries a network failure that isn't an ApiError", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
  });

  it("never retries things that can't fix themselves", () => {
    expect(shouldRetry(0, new ApiError("not_found"))).toBe(false);
    expect(shouldRetry(0, new ApiError("bad_request"))).toBe(false);
  });

  it("retries a short rate limit but surfaces a long one right away", () => {
    expect(
      shouldRetry(0, new ApiError("rate_limited", undefined, { retryAfter: 3 })),
    ).toBe(true);
    expect(
      shouldRetry(0, new ApiError("rate_limited", undefined, { retryAfter: 53 })),
    ).toBe(false);
  });

  it("retries a rate limit that gave no wait time", () => {
    expect(shouldRetry(0, new ApiError("rate_limited"))).toBe(true);
  });
});

describe("retryDelay", () => {
  it("waits exactly as long as the upstream asked", () => {
    expect(
      retryDelay(0, new ApiError("rate_limited", undefined, { retryAfter: 4 })),
    ).toBe(4000);
  });

  it("backs off exponentially (with jitter) otherwise, capped at 8s", () => {
    const error = new ApiError("upstream_error");
    expect(retryDelay(0, error)).toBeGreaterThanOrEqual(1000);
    expect(retryDelay(0, error)).toBeLessThan(1300);
    expect(retryDelay(1, error)).toBeGreaterThanOrEqual(2000);
    expect(retryDelay(10, error)).toBeLessThan(8300);
  });
});
