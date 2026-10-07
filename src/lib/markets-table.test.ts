import { describe, expect, it } from "vitest";
import { makeCoin } from "@/test/fixtures";
import {
  PAGE_SIZE,
  filterCoins,
  pageCountFor,
  paginate,
  sortCoins,
} from "./markets-table";

const ids = (coins: { id: string }[]) => coins.map((c) => c.id);

describe("sortCoins", () => {
  const coins = [
    makeCoin({ id: "a", name: "Alpha", rank: 3, price: 10, change24h: 5 }),
    makeCoin({ id: "b", name: "bravo", rank: 1, price: 300, change24h: -2 }),
    makeCoin({ id: "c", name: "Charlie", rank: 2, price: 5, change24h: 12 }),
  ];

  it("sorts numeric columns in both directions", () => {
    expect(ids(sortCoins(coins, "price", "desc"))).toEqual(["b", "a", "c"]);
    expect(ids(sortCoins(coins, "price", "asc"))).toEqual(["c", "a", "b"]);
    expect(ids(sortCoins(coins, "rank", "asc"))).toEqual(["b", "c", "a"]);
  });

  it("sorts names case-insensitively", () => {
    expect(ids(sortCoins(coins, "name", "asc"))).toEqual(["a", "b", "c"]);
    expect(ids(sortCoins(coins, "name", "desc"))).toEqual(["c", "b", "a"]);
  });

  it("puts coins with no value last in EITHER direction", () => {
    const withGap = [
      makeCoin({ id: "x", change7d: null, rank: 1 }),
      makeCoin({ id: "y", change7d: -9, rank: 2 }),
      makeCoin({ id: "z", change7d: 4, rank: 3 }),
    ];
    expect(ids(sortCoins(withGap, "change7d", "desc"))).toEqual(["z", "y", "x"]);
    expect(ids(sortCoins(withGap, "change7d", "asc"))).toEqual(["y", "z", "x"]);
  });

  it("breaks ties by rank so the order is stable between refreshes", () => {
    const tied = [
      makeCoin({ id: "late", price: 1, rank: 9 }),
      makeCoin({ id: "early", price: 1, rank: 2 }),
      makeCoin({ id: "mid", price: 1, rank: 5 }),
    ];
    expect(ids(sortCoins(tied, "price", "desc"))).toEqual(["early", "mid", "late"]);
    expect(ids(sortCoins(tied, "price", "asc"))).toEqual(["early", "mid", "late"]);
  });

  it("orders several missing values by rank, and treats a missing rank as last", () => {
    const missing = [
      makeCoin({ id: "p", marketCap: null, rank: null }),
      makeCoin({ id: "q", marketCap: null, rank: 4 }),
    ];
    expect(ids(sortCoins(missing, "marketCap", "desc"))).toEqual(["q", "p"]);
  });

  it("does not mutate its input", () => {
    const input = [...coins];
    sortCoins(input, "price", "asc");
    expect(ids(input)).toEqual(["a", "b", "c"]);
  });
});

describe("filterCoins", () => {
  const coins = [
    makeCoin({ id: "bitcoin", name: "Bitcoin", symbol: "BTC", change24h: 3 }),
    makeCoin({ id: "ethereum", name: "Ethereum", symbol: "ETH", change24h: -4 }),
    makeCoin({ id: "tether", name: "Tether", symbol: "USDT", change24h: 0 }),
    makeCoin({ id: "gap", name: "Gap", symbol: "GAP", change24h: null }),
  ];

  it("matches name or symbol, case-insensitively, ignoring surrounding spaces", () => {
    expect(ids(filterCoins(coins, { q: "BIT", view: "all" }))).toEqual(["bitcoin"]);
    expect(ids(filterCoins(coins, { q: " usdt ", view: "all" }))).toEqual(["tether"]);
    expect(ids(filterCoins(coins, { q: "eth", view: "all" }))).toEqual([
      "ethereum",
      "tether",
    ]);
  });

  it("returns everything for an empty or whitespace query", () => {
    expect(filterCoins(coins, { q: "", view: "all" })).toHaveLength(4);
    expect(filterCoins(coins, { q: "   ", view: "all" })).toHaveLength(4);
  });

  it("gainers/losers only include coins that actually moved", () => {
    expect(ids(filterCoins(coins, { q: "", view: "gainers" }))).toEqual(["bitcoin"]);
    expect(ids(filterCoins(coins, { q: "", view: "losers" }))).toEqual(["ethereum"]);
  });

  it("a coin that rounds to 0.00% is neither a gainer nor a loser (matches what the table shows)", () => {
    const flat = [
      makeCoin({ id: "tiny-up", change24h: 0.004 }),
      makeCoin({ id: "tiny-down", change24h: -0.004 }),
      makeCoin({ id: "real-up", change24h: 0.2 }),
    ];
    expect(ids(filterCoins(flat, { q: "", view: "gainers" }))).toEqual(["real-up"]);
    expect(filterCoins(flat, { q: "", view: "losers" })).toEqual([]);
  });

  it("combines search and view", () => {
    expect(filterCoins(coins, { q: "eth", view: "gainers" })).toEqual([]);
  });

  it("does not treat user input as a pattern", () => {
    expect(filterCoins(coins, { q: ".*", view: "all" })).toEqual([]);
    expect(filterCoins(coins, { q: "(", view: "all" })).toEqual([]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 60 }, (_, i) => i + 1);

  it("slices a page and reports the range shown", () => {
    const p = paginate(items, 2);
    expect(p.items).toHaveLength(PAGE_SIZE);
    expect(p.items[0]).toBe(PAGE_SIZE + 1);
    expect(p).toMatchObject({ page: 2, pageCount: 3, from: 26, to: 50, total: 60 });
  });

  it("the last page is a short page", () => {
    const p = paginate(items, 3);
    expect(p.items).toHaveLength(10);
    expect(p).toMatchObject({ from: 51, to: 60 });
  });

  it("clamps out-of-range and junk pages instead of showing nothing", () => {
    expect(paginate(items, 99).page).toBe(3);
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate(items, -4).page).toBe(1);
    expect(paginate(items, Number.NaN).page).toBe(1);
  });

  it("handles no results", () => {
    expect(paginate([], 1)).toMatchObject({
      items: [],
      page: 1,
      pageCount: 1,
      from: 0,
      to: 0,
      total: 0,
    });
  });

  it("counts pages", () => {
    expect(pageCountFor(0)).toBe(1);
    expect(pageCountFor(25)).toBe(1);
    expect(pageCountFor(26)).toBe(2);
    expect(pageCountFor(100)).toBe(4);
  });
});
