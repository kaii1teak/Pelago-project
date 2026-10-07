import { describe, expect, it } from "vitest";
import { ApiError, isApiError } from "./errors";

describe("ApiError", () => {
  it("derives the HTTP status from the code", () => {
    expect(new ApiError("rate_limited").status).toBe(429);
    expect(new ApiError("not_found").status).toBe(404);
    expect(new ApiError("upstream_error").status).toBe(502);
  });

  it("only marks transient failures as retryable", () => {
    expect(new ApiError("rate_limited").retryable).toBe(true);
    expect(new ApiError("network").retryable).toBe(true);
    expect(new ApiError("not_found").retryable).toBe(false);
    expect(new ApiError("bad_request").retryable).toBe(false);
  });

  it("survives a round trip through the JSON body route handlers send", () => {
    const original = new ApiError("rate_limited", "Slow down", { retryAfter: 12 });
    const rebuilt = ApiError.fromBody(JSON.parse(JSON.stringify(original.toBody())));
    expect(rebuilt).toBeInstanceOf(ApiError);
    expect(rebuilt).toMatchObject({
      code: "rate_limited",
      message: "Slow down",
      retryAfter: 12,
    });
  });

  it("rejects bodies that aren't ours instead of guessing", () => {
    expect(ApiError.fromBody(null)).toBeNull();
    expect(ApiError.fromBody({})).toBeNull();
    expect(ApiError.fromBody({ error: { code: "made_up" } })).toBeNull();
    expect(ApiError.fromBody("nope")).toBeNull();
  });

  it("isApiError narrows correctly", () => {
    expect(isApiError(new ApiError("network"))).toBe(true);
    expect(isApiError(new Error("x"))).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});
