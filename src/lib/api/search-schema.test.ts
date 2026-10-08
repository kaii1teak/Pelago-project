import { describe, expect, it } from "vitest";
import { MAX_SEARCH_RESULTS, searchSchema } from "./schemas";

const coin = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `coin-${n}`,
  name: `Coin ${n}`,
  api_symbol: `coin-${n}`,
  symbol: `c${n}`,
  market_cap_rank: n,
  thumb: `https://img/${n}/thumb.png`,
  large: `https://img/${n}/large.png`,
  ...extra,
});

describe("searchSchema", () => {
  it("keeps only what the palette needs, with the symbol upper-cased", () => {
    const [first] = searchSchema.parse({
      coins: [coin(1)],
      exchanges: [{ id: "x" }],
      nfts: [],
    });
    expect(first).toEqual({
      id: "coin-1",
      name: "Coin 1",
      symbol: "C1",
      rank: 1,
      image: "https://img/1/large.png",
    });
  });

  it("ignores the other result kinds the endpoint returns", () => {
    const parsed = searchSchema.parse({
      coins: [coin(1)],
      exchanges: [{ id: "binance" }],
      icos: [],
      categories: [{ id: "defi" }],
      nfts: [{ id: "punks" }],
    });
    expect(parsed).toHaveLength(1);
  });

  it("allows a coin with no rank or no image", () => {
    const [c] = searchSchema.parse({
      coins: [coin(9, { market_cap_rank: null, large: null })],
    });
    expect(c!.rank).toBeNull();
    expect(c!.image).toBeNull();
  });

  it("turns an odd rank into null instead of failing the whole list", () => {
    const parsed = searchSchema.parse({
      coins: [coin(1, { market_cap_rank: "n/a" }), coin(2)],
    });
    expect(parsed.map((c) => c.rank)).toEqual([null, 2]);
  });

  it(`never returns more than ${MAX_SEARCH_RESULTS} coins`, () => {
    const coins = Array.from({ length: 30 }, (_, i) => coin(i + 1));
    expect(searchSchema.parse({ coins })).toHaveLength(MAX_SEARCH_RESULTS);
  });

  it("returns an empty list for no matches", () => {
    expect(searchSchema.parse({ coins: [] })).toEqual([]);
  });

  it("rejects a response without a coins list (so it surfaces as invalid_response)", () => {
    expect(searchSchema.safeParse({}).success).toBe(false);
    expect(searchSchema.safeParse({ coins: "nope" }).success).toBe(false);
  });
});
