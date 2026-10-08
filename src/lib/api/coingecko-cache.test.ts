import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LAST_GOOD_MAX_ENTRIES, __resetLastGoodForTests, cgFetch } from "./coingecko";

const schema = z.object({ n: z.number() });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  __resetLastGoodForTests();
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ok = (n: number) => new Response(JSON.stringify({ n }), { status: 200 });
const rateLimited = () => new Response("", { status: 429 });
const call = (query: string) =>
  cgFetch("/search", schema, { params: { query }, revalidate: 300 });

describe("cgFetch: the last-good fallback is bounded", () => {
  it("still serves the last good answer for a query when the upstream rate-limits", async () => {
    fetchMock.mockResolvedValueOnce(ok(1));
    await call("bitcoin");
    fetchMock.mockResolvedValueOnce(rateLimited());
    const result = await call("bitcoin");
    expect(result).toEqual({ data: { n: 1 }, stale: true });
  });

  it("forgets the oldest queries instead of growing without limit", async () => {
    // Free-text searches mean unbounded distinct keys: only the newest are kept.
    for (let i = 0; i < LAST_GOOD_MAX_ENTRIES + 5; i++) {
      fetchMock.mockResolvedValueOnce(ok(i));
      await call(`query-${i}`);
    }

    fetchMock.mockResolvedValueOnce(rateLimited());
    await expect(call("query-0")).rejects.toMatchObject({ code: "rate_limited" });

    fetchMock.mockResolvedValueOnce(rateLimited());
    const newest = await call(`query-${LAST_GOOD_MAX_ENTRIES + 4}`);
    expect(newest.stale).toBe(true);
  });

  it("a query that is asked again counts as fresh, not as old", async () => {
    for (let i = 0; i < LAST_GOOD_MAX_ENTRIES; i++) {
      fetchMock.mockResolvedValueOnce(ok(i));
      await call(`query-${i}`);
    }
    // Ask the very oldest again, then add one more: the oldest *unused* goes, not this one.
    fetchMock.mockResolvedValueOnce(ok(100));
    await call("query-0");
    fetchMock.mockResolvedValueOnce(ok(101));
    await call("one-more");

    fetchMock.mockResolvedValueOnce(rateLimited());
    expect((await call("query-0")).stale).toBe(true);
    fetchMock.mockResolvedValueOnce(rateLimited());
    await expect(call("query-1")).rejects.toMatchObject({ code: "rate_limited" });
  });
});
