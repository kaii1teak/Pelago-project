import { describe, expect, it } from "vitest";
import { marketsUrl, normalizeMarketsParams } from "./markets-query";
import { parseMarketsParams } from "./parse-markets";
import { queryKeys } from "./query-keys";

const parse = (qs: string) => parseMarketsParams(new URLSearchParams(qs));

describe("parseMarketsParams", () => {
  it("applies defaults", () => {
    expect(parse("")).toEqual({
      ids: undefined,
      category: undefined,
      page: 1,
      perPage: 100,
    });
  });

  it("parses ids, category, page and per_page", () => {
    expect(parse("ids=bitcoin,ethereum&category=layer-1&page=2&per_page=50")).toEqual({
      ids: ["bitcoin", "ethereum"],
      category: "layer-1",
      page: 2,
      perPage: 50,
    });
  });

  it.each([
    ["ids with characters outside the coin-id alphabet", "ids=bitcoin,../etc"],
    ["ids with uppercase or spaces", "ids=Bitcoin"],
    [
      "more than 50 ids",
      `ids=${Array.from({ length: 51 }, (_, i) => `c${i}`).join(",")}`,
    ],
    ["a category that smuggles in another parameter", "category=x%26vs_currency%3Deur"],
    ["a well-formed category that is not on the allowlist", "category=made-up-category"],
    ["a page below 1", "page=0"],
    ["a page far too high", "page=9999"],
    ["a non-numeric page", "page=abc"],
    ["an unsupported page size", "per_page=1000"],
  ])("rejects %s with a bad_request error", (_label, qs) => {
    expect(() => parse(qs)).toThrowError(
      expect.objectContaining({ code: "bad_request" }),
    );
  });

  it("ignores unknown parameters instead of passing them through", () => {
    // `getMarkets` only forwards the fields parseMarketsParams returns, so a caller
    // can't override vs_currency, order, sparkline, etc. on the upstream request.
    expect(
      parse("category=decentralized-finance-defi&vs_currency=eur&order=id_asc"),
    ).toEqual({
      ids: undefined,
      category: "decentralized-finance-defi",
      page: 1,
      perPage: 100,
    });
  });

  it("accepts exactly 50 ids", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `c${i}`).join(",");
    expect(parse(`ids=${ids}`).ids).toHaveLength(50);
  });
});

describe("normalizeMarketsParams / marketsUrl", () => {
  it("sorts and de-duplicates ids so equal sets are the same request", () => {
    expect(normalizeMarketsParams({ ids: ["eth", "btc", "eth"] }).ids).toEqual([
      "btc",
      "eth",
    ]);
    expect(marketsUrl({ ids: ["eth", "btc"] })).toBe(marketsUrl({ ids: ["btc", "eth"] }));
  });

  it("drops default values so the plain request has a plain URL", () => {
    expect(marketsUrl()).toBe("/api/markets");
    expect(marketsUrl({ page: 1, perPage: 100, ids: [] })).toBe("/api/markets");
  });

  it("encodes non-default values", () => {
    expect(
      marketsUrl({ ids: ["btc", "eth"], page: 3, perPage: 25, category: "defi" }),
    ).toBe("/api/markets?ids=btc%2Ceth&category=defi&page=3&per_page=25");
  });

  it("gives equal requests the same query key (so they share one cache entry)", () => {
    expect(queryKeys.markets({ ids: ["b", "a"] })).toEqual(
      queryKeys.markets({ ids: ["a", "b"] }),
    );
    expect(queryKeys.markets()).toEqual(queryKeys.markets({ page: 1, perPage: 100 }));
    expect(queryKeys.markets({ ids: ["a"] })).not.toEqual(
      queryKeys.markets({ ids: ["b"] }),
    );
  });
});
