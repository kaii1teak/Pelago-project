import { describe, expect, it } from "vitest";
import { globalFixture, marketsFixture } from "@/test/fixtures";
import { globalStatsSchema, marketsSchema } from "./schemas";

describe("globalStatsSchema", () => {
  it("reshapes CoinGecko's payload into the lean app type", () => {
    expect(globalStatsSchema.parse(globalFixture)).toEqual({
      totalMarketCap: 2_410_000_000_000,
      btcDominance: 52.41,
      ethDominance: 17.08,
      marketCapChange24h: -1.2345,
      activeCryptocurrencies: 17432,
      markets: 1245,
      updatedAt: 1_759_700_000,
    });
  });

  it("does not expose CoinGecko's /global total_volume (known-bad upstream value)", () => {
    expect(globalStatsSchema.parse(globalFixture)).not.toHaveProperty("totalVolume24h");
  });

  it("tolerates a missing 24h change and missing dominance entries", () => {
    const payload = {
      data: {
        ...globalFixture.data,
        market_cap_change_percentage_24h_usd: undefined,
        market_cap_percentage: {},
      },
    };
    const parsed = globalStatsSchema.parse(payload);
    expect(parsed.marketCapChange24h).toBeNull();
    expect(parsed.btcDominance).toBeNull();
  });

  it("rejects a payload without a USD market cap", () => {
    const payload = { data: { ...globalFixture.data, total_market_cap: { eur: 1 } } };
    expect(globalStatsSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects the wrong shape entirely", () => {
    expect(globalStatsSchema.safeParse({ nope: true }).success).toBe(false);
    expect(globalStatsSchema.safeParse(null).success).toBe(false);
  });
});

describe("marketsSchema", () => {
  const [bitcoin, newCoin] = marketsSchema.parse(marketsFixture);

  it("renames fields, uppercases the symbol and drops unknown fields", () => {
    expect(bitcoin).toMatchObject({
      id: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      price: 67432.12,
      marketCap: 1_330_000_000_000,
      rank: 1,
      volume24h: 31_000_000_000,
      change1h: 0.12,
      change24h: 1.48,
      change7d: -2.3,
    });
    expect(bitcoin).not.toHaveProperty("ath");
    expect(bitcoin).not.toHaveProperty("roi");
  });

  it("downsamples the 7-day sparkline to keep the payload small", () => {
    expect(bitcoin!.sparkline).toHaveLength(42);
    // Hourly input rose linearly, so the reduced series must still rise.
    expect(bitcoin!.sparkline[41]).toBeGreaterThan(bitcoin!.sparkline[0]!);
  });

  it("turns missing values into null instead of failing or producing NaN", () => {
    expect(newCoin).toMatchObject({
      image: null,
      marketCap: null,
      rank: null,
      high24h: null,
      change1h: null,
      change7d: null,
      sparkline: [],
    });
  });

  it("falls back to the base 24h change when the in-currency one is null", () => {
    expect(newCoin!.change24h).toBe(9.9);
  });

  it("rejects entries missing required identity fields", () => {
    expect(marketsSchema.safeParse([{ symbol: "x" }]).success).toBe(false);
  });
});
