import { describe, expect, it } from "vitest";
import { coinFixture, ohlcFixture, priceChartFixture } from "@/test/fixtures";
import { ApiError } from "./errors";
import { parseChartBack, parseChartRange, parseCoinId } from "./parse-coin";
import { coinDetailSchema, ohlcSchema, priceChartSchema } from "./schemas";

describe("coinDetailSchema", () => {
  const coin = coinDetailSchema.parse(coinFixture);

  it("reshapes the payload into the app's own field names", () => {
    expect(coin).toMatchObject({
      id: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      rank: 1,
      genesisDate: "2009-01-03",
      image: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
    });
    expect(coin.market).toMatchObject({
      price: 83753,
      marketCap: 1_682_902_943_476,
      volume24h: 35_795_803_007,
      high24h: 86648,
      low24h: 83610,
      change24h: -2.7723,
      change1y: -32.62003,
      ath: 126080,
      athDate: "2025-10-06T10:57:42.000Z",
      atlChange: 123413.7976,
      maxSupply: 21_000_000,
    });
  });

  it("turns the description into plain-text paragraphs (no markup survives)", () => {
    expect(coin.description).toEqual([
      "Bitcoin is the first decentralized cryptocurrency. It runs on a peer-to-peer network.",
      "Second paragraph & more <3.",
    ]);
    expect(coin.description.join(" ")).not.toMatch(/<\/?[a-z]|alert/i);
  });

  it("keeps only safe, de-duplicated links, and caps explorers at three", () => {
    expect(coin.links).toEqual({
      website: "http://www.bitcoin.org/",
      whitepaper: "https://bitcoin.org/bitcoin.pdf",
      explorers: [
        "https://mempool.space/",
        "https://btc.com/",
        "https://explorer3.example/",
      ],
      forum: "https://bitcointalk.org/",
      reddit: "https://www.reddit.com/r/Bitcoin/",
      twitter: "https://x.com/bitcoin",
      github: "https://github.com/bitcoin/bitcoin",
    });
    const all = JSON.stringify(coin.links);
    expect(all).not.toContain("javascript:");
  });

  it("drops null categories", () => {
    expect(coin.categories).toEqual([
      "Smart Contract Platform",
      "Layer 1 (L1)",
      "Proof of Work (PoW)",
    ]);
  });

  it("builds the X link only from a well-formed handle", () => {
    const bad = coinDetailSchema.parse({
      ...coinFixture,
      links: { twitter_screen_name: "a/../b?x=1" },
    });
    expect(bad.links.twitter).toBeNull();
  });

  it("survives a minimal payload (new listings have almost nothing)", () => {
    const bare = coinDetailSchema.parse({
      id: "newcoin",
      symbol: "new",
      name: "New Coin",
    });
    expect(bare.rank).toBeNull();
    expect(bare.description).toEqual([]);
    expect(bare.categories).toEqual([]);
    expect(bare.links.explorers).toEqual([]);
    expect(Object.values(bare.market).every((v) => v === null)).toBe(true);
  });

  it("treats nulls inside market data as missing, not as zero", () => {
    const sparse = coinDetailSchema.parse({
      ...coinFixture,
      market_data: { current_price: { usd: null }, max_supply: null, total_supply: null },
    });
    expect(sparse.market.price).toBeNull();
    expect(sparse.market.maxSupply).toBeNull();
  });

  it("does not fail when optional link keys are missing entirely", () => {
    // Real payloads usually include every key, but one that doesn't must not break the page.
    const sparse = coinDetailSchema.parse({
      ...coinFixture,
      links: { homepage: ["https://x.test"] },
    });
    expect(sparse.links).toMatchObject({
      website: "https://x.test/",
      whitepaper: null,
      reddit: null,
    });
  });

  it("rejects a payload with no identity", () => {
    expect(coinDetailSchema.safeParse({ symbol: "x" }).success).toBe(false);
    expect(coinDetailSchema.safeParse(null).success).toBe(false);
  });
});

describe("priceChartSchema", () => {
  it("returns sorted, unique, finite points in seconds", () => {
    const out = priceChartSchema.parse(priceChartFixture);
    expect(out).toEqual([
      { time: 1_791_285_000, value: 86001 },
      { time: 1_791_285_300, value: 86082.85 },
      { time: 1_791_285_900, value: 86100.1 },
    ]);
  });

  it("rejects a response without prices", () => {
    expect(priceChartSchema.safeParse({ total_volumes: [] }).success).toBe(false);
  });
});

describe("ohlcSchema", () => {
  it("returns sorted candles and drops incomplete rows", () => {
    const out = ohlcSchema.parse(ohlcFixture);
    expect(out.map((c) => c.time)).toEqual([1_791_284_400, 1_791_286_200, 1_791_287_999]);
    expect(
      out.every((c) => [c.open, c.high, c.low, c.close].every(Number.isFinite)),
    ).toBe(true);
  });

  it("rejects something that isn't a list of rows", () => {
    expect(ohlcSchema.safeParse({ error: "nope" }).success).toBe(false);
  });
});

describe("request parsing", () => {
  it("coin ids that can't exist are 'not found', never forwarded upstream", () => {
    expect(parseCoinId("bitcoin")).toBe("bitcoin");
    for (const bad of ["Bitcoin", "../x", "a b", "", "x".repeat(101)]) {
      expect(() => parseCoinId(bad)).toThrowError(
        expect.objectContaining({ code: "not_found" }),
      );
    }
  });

  it("chart ranges default to 7d and reject unknown values", () => {
    expect(parseChartRange(new URLSearchParams(""))).toBe("7d");
    expect(parseChartRange(new URLSearchParams("range=1y"))).toBe("1y");
    expect(() => parseChartRange(new URLSearchParams("range=10y"))).toThrowError(
      ApiError,
    );
    expect(() => parseChartRange(new URLSearchParams("range=10y"))).toThrowError(
      expect.objectContaining({ code: "bad_request" }),
    );
  });
});

describe("parseChartBack", () => {
  const parse = (q: string, range: "24h" | "7d" | "30d" | "1y" = "7d") =>
    parseChartBack(new URLSearchParams(q), range);

  it("is 0, the chart's own window, when absent", () => {
    expect(parse("")).toBe(0);
    expect(parse("range=7d")).toBe(0);
  });

  it("reads a whole step", () => {
    expect(parse("back=3")).toBe(3);
  });

  it.each(["0", "-1", "1.5", "abc", "", "1e3", "01x", " 2", "9999", "99"])(
    "rejects %j as a bad request",
    (value) => {
      expect(() => parse(`back=${value}`)).toThrow(ApiError);
    },
  );

  it("rejects any step for 1y", () => {
    expect(() => parse("back=1", "1y")).toThrow(ApiError);
  });
});
