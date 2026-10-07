import { describe, expect, it } from "vitest";
import { trendingFixture } from "@/test/fixtures";
import { trendingSchema } from "./schemas";

describe("trendingSchema", () => {
  const [orca, mystery, bare] = trendingSchema.parse(trendingFixture);

  it("flattens CoinGecko's nested item/data structure", () => {
    expect(orca).toEqual({
      id: "orca",
      name: "Orca",
      symbol: "ORCA",
      rank: 194,
      image:
        "https://coin-images.coingecko.com/coins/images/17547/small/Orca_Logo.png?1696517083",
      price: 3.126092483655871,
      change24h: 32.96529747955997,
    });
  });

  it("turns a non-numeric price into null instead of failing the whole list", () => {
    expect(mystery).toMatchObject({
      symbol: "MYS",
      rank: null,
      image: null,
      price: null,
      change24h: null,
    });
  });

  it("tolerates an item with no data block at all", () => {
    expect(bare).toMatchObject({ id: "bare", price: null, change24h: null, rank: 5 });
  });

  it("keeps every item (one odd coin doesn't drop the others)", () => {
    expect(trendingSchema.parse(trendingFixture)).toHaveLength(3);
  });

  it("keeps an item whose optional keys are missing entirely", () => {
    const parsed = trendingSchema.parse({
      coins: [{ item: { id: "x", name: "X", symbol: "x" } }],
    });
    expect(parsed).toEqual([
      {
        id: "x",
        name: "X",
        symbol: "X",
        rank: null,
        image: null,
        price: null,
        change24h: null,
      },
    ]);
  });

  it("rejects a payload that isn't a trending response", () => {
    expect(trendingSchema.safeParse({ nope: 1 }).success).toBe(false);
  });
});
