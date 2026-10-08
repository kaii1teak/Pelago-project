import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  normalizeSearchText,
  parseSearchQuery,
} from "./parse-search";

const parse = (q?: string) =>
  parseSearchQuery(new URLSearchParams(q === undefined ? "" : { q }));

describe("normalizeSearchText", () => {
  it("trims, lower-cases and collapses whitespace: one search, one cache entry", () => {
    expect(normalizeSearchText("  Bit   COIN ")).toBe("bit coin");
    expect(normalizeSearchText("bit\tcoin\n")).toBe("bit coin");
  });
});

describe("parseSearchQuery", () => {
  it("returns the canonical form", () => {
    expect(parse("  Bitcoin ")).toBe("bitcoin");
    expect(parse("Bit  Coin")).toBe(parse("bit coin"));
  });

  it("accepts the characters real coin names use", () => {
    expect(parse("usd-coin")).toBe("usd-coin");
    expect(parse("wrapped.btc")).toBe("wrapped.btc");
    expect(parse("1inch")).toBe("1inch");
    expect(parse("a_b")).toBe("a_b");
  });

  it("accepts non-latin letters", () => {
    expect(parse("биткоин")).toBe("биткоин");
    expect(parse("比特币")).toBe("比特币");
  });

  it.each([undefined, "", " ", "a"])("rejects a missing or too short query (%j)", (q) => {
    expect(() => parse(q)).toThrow(ApiError);
    try {
      parse(q);
    } catch (error) {
      expect((error as ApiError).code).toBe("bad_request");
    }
  });

  it(`rejects more than ${MAX_QUERY_LENGTH} characters, accepts exactly that many`, () => {
    expect(() => parse("a".repeat(MAX_QUERY_LENGTH + 1))).toThrow(ApiError);
    expect(parse("a".repeat(MAX_QUERY_LENGTH))).toHaveLength(MAX_QUERY_LENGTH);
  });

  it(`needs at least ${MIN_QUERY_LENGTH} characters after trimming`, () => {
    expect(() => parse("  a  ")).toThrow(ApiError);
    expect(parse("ab")).toBe("ab");
  });

  it.each([
    "btc&ids=x",
    "a/b",
    "../etc",
    "<script>",
    "btc;drop",
    "a?b",
    "50%",
    "a#b",
    "x\u0000y",
  ])("rejects characters that don't belong in a coin search (%j)", (q) => {
    expect(() => parse(q)).toThrow(ApiError);
  });
});
