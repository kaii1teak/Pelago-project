import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, marketsStateToSearch, parseMarketsState } from "./markets-url";

const parse = (qs: string) => parseMarketsState(new URLSearchParams(qs));

describe("parseMarketsState", () => {
  it("an empty URL is the default state", () => {
    expect(parse("")).toEqual(DEFAULT_STATE);
  });

  it("reads every field", () => {
    expect(
      parse("q=sol&sort=marketCap&dir=asc&view=gainers&category=layer-1&page=3"),
    ).toEqual({
      q: "sol",
      sort: "marketCap",
      dir: "asc",
      view: "gainers",
      category: "layer-1",
      page: 3,
    });
  });

  it("falls back to each column's natural direction when dir is absent", () => {
    expect(parse("sort=price").dir).toBe("desc");
    expect(parse("sort=name").dir).toBe("asc");
  });

  it.each([
    ["an unknown sort key", "sort=hax", "sort", "rank"],
    ["an unknown view", "view=everything", "view", "all"],
    ["a non-numeric page", "page=abc", "page", 1],
    ["a negative page", "page=-3", "page", 1],
    ["a fractional page", "page=2.5", "page", 2],
    ["a category with unsafe characters", "category=a%26b%3Dc", "category", null],
    ["an uppercase category", "category=Layer-1", "category", null],
    [
      "a well-formed category that is not on the allowlist",
      "category=made-up-category",
      "category",
      null,
    ],
  ] as const)("ignores %s instead of failing", (_label, qs, field, expected) => {
    expect(parse(qs)[field]).toEqual(expected);
  });

  it("trims and length-limits the search text", () => {
    expect(parse("q=%20%20btc%20").q).toBe("btc");
    expect(parse(`q=${"x".repeat(500)}`).q).toHaveLength(60);
  });
});

describe("marketsStateToSearch", () => {
  it("the default state has no query string", () => {
    expect(marketsStateToSearch(DEFAULT_STATE)).toBe("");
  });

  it("omits anything that matches a default", () => {
    expect(marketsStateToSearch({ ...DEFAULT_STATE, sort: "price", dir: "desc" })).toBe(
      "sort=price",
    );
    expect(marketsStateToSearch({ ...DEFAULT_STATE, sort: "price", dir: "asc" })).toBe(
      "sort=price&dir=asc",
    );
    expect(marketsStateToSearch({ ...DEFAULT_STATE, page: 1 })).toBe("");
  });

  it("round-trips any state", () => {
    const states = [
      { ...DEFAULT_STATE, q: "a b&c=d", category: "meme-token", page: 4 },
      {
        ...DEFAULT_STATE,
        sort: "change7d" as const,
        dir: "asc" as const,
        view: "losers" as const,
      },
      { ...DEFAULT_STATE, sort: "name" as const, dir: "desc" as const },
    ];
    for (const s of states) {
      expect(parse(marketsStateToSearch(s))).toEqual(s);
    }
  });
});
