import { describe, expect, it } from "vitest";
import { marketsFixture } from "@/test/fixtures";
import { HEATMAP_COUNT } from "./markets-query";
import { parseHeatmapParams } from "./parse-heatmap";
import { queryKeys } from "./query-keys";
import { heatmapSchema } from "./schemas";

const parse = (qs: string) => parseHeatmapParams(new URLSearchParams(qs));

describe("heatmapSchema", () => {
  const [bitcoin, brandNew] = heatmapSchema.parse(marketsFixture);

  it("keeps what a cell shows, and nothing else", () => {
    expect(bitcoin).toEqual({
      id: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      image: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
      rank: 1,
      price: 67432.12,
      marketCap: 1_330_000_000_000,
      volume24h: 31_000_000_000,
      change1h: 0.12,
      change24h: 1.48,
      change7d: -2.3,
    });
    // The sparkline is what makes the markets payload heavy; the heatmap neither asks for nor keeps it.
    expect(bitcoin).not.toHaveProperty("sparkline");
  });

  it("lets a coin with nothing computed through, as nulls", () => {
    expect(brandNew).toMatchObject({
      marketCap: null,
      rank: null,
      change1h: null,
      change7d: null,
    });
  });

  it("parses a response that has no sparkline at all", () => {
    const withoutSparkline = { ...marketsFixture[0]!, sparkline_in_7d: undefined };
    expect(heatmapSchema.parse([withoutSparkline])).toHaveLength(1);
  });

  it("rejects the wrong shape", () => {
    expect(heatmapSchema.safeParse({ nope: true }).success).toBe(false);
  });
});

describe("parseHeatmapParams", () => {
  it("is happy with no parameters", () => {
    expect(parse("")).toEqual({ category: undefined });
  });

  it("accepts a curated category", () => {
    expect(parse("category=layer-2")).toEqual({ category: "layer-2" });
  });

  it.each([
    ["a category that is not on the allowlist", "category=made-up-category"],
    ["a category that smuggles in another parameter", "category=x%26vs_currency%3Deur"],
  ])("rejects %s", (_label, qs) => {
    expect(() => parse(qs)).toThrowError(
      expect.objectContaining({ code: "bad_request" }),
    );
  });

  it("ignores anything else, so a caller can't steer the upstream request", () => {
    expect(parse("category=gaming&per_page=250&vs_currency=eur&sparkline=true")).toEqual({
      category: "gaming",
    });
  });
});

describe("the heatmap request", () => {
  it("asks for the biggest universe the controls offer, in one go", () => {
    expect(HEATMAP_COUNT).toBe(200);
  });

  it("is cached per category, and the default has its own stable key", () => {
    expect(queryKeys.heatmap()).toEqual(["heatmap", null]);
    expect(queryKeys.heatmap(null)).toEqual(queryKeys.heatmap());
    expect(queryKeys.heatmap("gaming")).not.toEqual(queryKeys.heatmap());
  });
});

describe("getHeatmap", () => {
  it("asks CoinGecko for one page of the biggest universe, without sparklines", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    const cgFetch = vi.fn().mockResolvedValue({ data: [], stale: false });
    vi.doMock("./coingecko", () => ({ cgFetch }));
    const { getHeatmap, REVALIDATE } = await import("./endpoints");

    await getHeatmap("gaming");

    const [path, , options] = cgFetch.mock.calls[0]!;
    expect(path).toBe("/coins/markets");
    expect(options.params).toMatchObject({
      vs_currency: "usd",
      order: "market_cap_desc",
      per_page: 200,
      page: 1,
      sparkline: false,
      price_change_percentage: "1h,24h,7d",
      category: "gaming",
    });
    expect(options.revalidate).toBe(REVALIDATE.heatmap);
    vi.doUnmock("./coingecko");
  });
});
