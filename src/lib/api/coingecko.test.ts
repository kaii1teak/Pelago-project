import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { globalFixture } from "@/test/fixtures";
import { __resetLastGoodForTests, cgFetch } from "./coingecko";
import { ApiError } from "./errors";
import { globalStatsSchema } from "./schemas";

const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const call = () => cgFetch("/global", globalStatsSchema, { revalidate: 120 });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  __resetLastGoodForTests();
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("cgFetch: success", () => {
  it("returns validated, reshaped data that isn't stale", async () => {
    fetchMock.mockResolvedValueOnce(json(globalFixture));
    const result = await call();
    expect(result.stale).toBe(false);
    expect(result.data.totalMarketCap).toBe(2_410_000_000_000);
  });

  it("passes the revalidate window and tags to Next's data cache", async () => {
    fetchMock.mockResolvedValueOnce(json(globalFixture));
    await cgFetch("/global", globalStatsSchema, { revalidate: 120, tags: ["global"] });
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      next: { revalidate: 120, tags: ["global"] },
    });
  });

  it("builds an order-independent URL so equal requests share one cache entry", async () => {
    fetchMock.mockResolvedValue(json(globalFixture));
    await cgFetch("/x", globalStatsSchema, { params: { b: 2, a: 1 }, revalidate: 60 });
    await cgFetch("/x", globalStatsSchema, { params: { a: 1, b: 2 }, revalidate: 60 });
    const [first, second] = fetchMock.mock.calls.map(([url]) => String(url));
    expect(first).toBe(second);
    expect(first).toMatch(/\/x\?a=1&b=2$/);
  });

  it("omits undefined and empty params", async () => {
    fetchMock.mockResolvedValueOnce(json(globalFixture));
    await cgFetch("/x", globalStatsSchema, {
      params: { a: 1, ids: undefined, category: "" },
      revalidate: 60,
    });
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/x\?a=1$/);
  });
});

describe("cgFetch: API key", () => {
  it("sends the Demo key header when configured", async () => {
    vi.stubEnv("COINGECKO_API_KEY", "demo-key-123");
    fetchMock.mockResolvedValueOnce(json(globalFixture));
    await call();
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["x-cg-demo-api-key"]).toBe("demo-key-123");
  });

  it("works keyless (no header at all)", async () => {
    vi.stubEnv("COINGECKO_API_KEY", "");
    fetchMock.mockResolvedValueOnce(json(globalFixture));
    await call();
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers).not.toHaveProperty("x-cg-demo-api-key");
  });
});

describe("cgFetch: failures map to typed ApiErrors", () => {
  it("429 -> rate_limited, carrying the upstream Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("", { status: 429, headers: { "retry-after": "7" } }),
    );
    await expect(call()).rejects.toMatchObject({
      code: "rate_limited",
      retryAfter: 7,
      status: 429,
    });
  });

  it("429 without Retry-After falls back to a 60s backoff", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 429 }));
    await expect(call()).rejects.toMatchObject({
      code: "rate_limited",
      retryAfter: 60,
    });
  });

  it("404 -> not_found, and is not retryable", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    const error = await call().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "not_found", retryable: false });
  });

  it("400 -> bad_request", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 400 }));
    await expect(call()).rejects.toMatchObject({ code: "bad_request" });
  });

  it("5xx -> upstream_error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
    await expect(call()).rejects.toMatchObject({ code: "upstream_error" });
  });

  it("401/403 -> upstream_error, logged for the operator", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 403 }));
    await expect(call()).rejects.toMatchObject({ code: "upstream_error" });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("COINGECKO_API_KEY"),
    );
  });

  it("network failure -> network", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(call()).rejects.toMatchObject({ code: "network" });
  });

  it("a body that fails validation -> invalid_response, never passed through", async () => {
    fetchMock.mockResolvedValueOnce(json({ unexpected: "shape" }));
    await expect(call()).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("non-JSON body -> invalid_response", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>oops</html>", { status: 200 }));
    await expect(call()).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("cgFetch: stale fallback", () => {
  it("serves the last good response, flagged stale, when the upstream rate-limits", async () => {
    fetchMock.mockResolvedValueOnce(json(globalFixture));
    const fresh = await call();

    fetchMock.mockResolvedValueOnce(new Response("", { status: 429 }));
    const fallback = await call();

    expect(fallback.stale).toBe(true);
    expect(fallback.data).toEqual(fresh.data);
  });

  it("also covers outages and network errors", async () => {
    fetchMock.mockResolvedValueOnce(json(globalFixture));
    await call();

    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    expect((await call()).stale).toBe(true);

    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    expect((await call()).stale).toBe(true);
  });

  it("recovers to fresh data once the upstream does", async () => {
    fetchMock.mockResolvedValueOnce(json(globalFixture));
    await call();
    fetchMock.mockResolvedValueOnce(new Response("", { status: 429 }));
    await call();
    fetchMock.mockResolvedValueOnce(json(globalFixture));
    expect((await call()).stale).toBe(false);
  });

  it("never papers over a 404 with old data", async () => {
    fetchMock.mockResolvedValueOnce(json(globalFixture));
    await call();
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    await expect(call()).rejects.toMatchObject({ code: "not_found" });
  });

  it("doesn't mix up different URLs", async () => {
    fetchMock.mockResolvedValueOnce(json(globalFixture));
    await cgFetch("/a", globalStatsSchema, { revalidate: 60 });
    fetchMock.mockResolvedValueOnce(new Response("", { status: 429 }));
    await expect(
      cgFetch("/b", globalStatsSchema, { revalidate: 60 }),
    ).rejects.toMatchObject({
      code: "rate_limited",
    });
  });
});

describe("cgFetch: unknown ids (negative cache)", () => {
  it("remembers a 404 so repeat requests don't spend upstream quota", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    await expect(call()).rejects.toMatchObject({ code: "not_found" });
    await expect(call()).rejects.toMatchObject({ code: "not_found" });
    await expect(call()).rejects.toMatchObject({ code: "not_found" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("only remembers the URL that 404ed", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    await expect(
      cgFetch("/coins/nope", globalStatsSchema, { revalidate: 60 }),
    ).rejects.toMatchObject({
      code: "not_found",
    });
    fetchMock.mockResolvedValueOnce(json(globalFixture));
    await expect(
      cgFetch("/coins/real", globalStatsSchema, { revalidate: 60 }),
    ).resolves.toMatchObject({
      stale: false,
    });
  });

  it("forgets after the TTL, so a coin listed later becomes reachable", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
      await expect(call()).rejects.toMatchObject({ code: "not_found" });

      vi.advanceTimersByTime(11 * 60 * 1000);
      fetchMock.mockResolvedValueOnce(json(globalFixture));
      await expect(call()).resolves.toMatchObject({ stale: false });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is bounded: it never grows without limit under a flood of distinct ids", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    for (let i = 0; i < 600; i++) {
      await cgFetch(`/coins/bogus-${i}`, globalStatsSchema, { revalidate: 60 }).catch(
        () => {},
      );
    }
    // The oldest entries were evicted, so the first id costs an upstream call again.
    fetchMock.mockClear();
    await cgFetch("/coins/bogus-0", globalStatsSchema, { revalidate: 60 }).catch(
      () => {},
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // ...while a recent one is still remembered.
    fetchMock.mockClear();
    await cgFetch("/coins/bogus-599", globalStatsSchema, { revalidate: 60 }).catch(
      () => {},
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
