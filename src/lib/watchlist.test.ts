import { describe, expect, it } from "vitest";
import { makeCoin } from "@/test/fixtures";
import { chunkIds, MAX_IDS } from "@/lib/api/markets-query";
import { matchWatchlist } from "./watchlist";

describe("matchWatchlist", () => {
  const btc = makeCoin({ id: "bitcoin" });
  const eth = makeCoin({ id: "ethereum" });
  const sol = makeCoin({ id: "solana" });

  it("keeps only the coins that are still saved", () => {
    const { rows } = matchWatchlist(["bitcoin", "solana"], [btc, eth, sol]);
    expect(rows.map((c) => c.id)).toEqual(["bitcoin", "solana"]);
  });

  it("returns saved ids the API had no coin for, in the order they were saved", () => {
    const { rows, missing } = matchWatchlist(["gone-b", "bitcoin", "gone-a"], [btc, eth]);
    expect(rows.map((c) => c.id)).toEqual(["bitcoin"]);
    expect(missing).toEqual(["gone-b", "gone-a"]);
  });

  it("is empty for an empty list, whatever the API returned", () => {
    expect(matchWatchlist([], [btc, eth])).toEqual({ rows: [], missing: [] });
  });

  it("does not mutate its inputs", () => {
    const ids = Object.freeze(["bitcoin"]);
    const coins = Object.freeze([btc, eth]);
    expect(() => matchWatchlist(ids, coins)).not.toThrow();
  });
});

describe("chunkIds", () => {
  it("returns nothing for no ids (so no request is made)", () => {
    expect(chunkIds([])).toEqual([]);
  });

  it("sorts and de-duplicates, so the same set is always the same request", () => {
    expect(chunkIds(["b", "a", "b"])).toEqual([["a", "b"]]);
    expect(chunkIds(["a", "b"])).toEqual(chunkIds(["b", "a"]));
  });

  it("splits at the API's per-request limit", () => {
    const ids = Array.from(
      { length: MAX_IDS * 2 + 1 },
      (_, i) => `coin${String(i).padStart(3, "0")}`,
    );
    const chunks = chunkIds(ids);
    expect(chunks.map((c) => c.length)).toEqual([MAX_IDS, MAX_IDS, 1]);
    expect(chunks.flat()).toEqual([...ids].sort());
  });
});
