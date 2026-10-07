import type { MarketCoin } from "@/lib/api/schemas";

/**
 * Matches the saved ids against what the API returned.
 *
 *  - `rows`: the coins still on the list. Filtering by the *current* ids is what
 *    makes removing instant: the request isn't repeated, the row just stops
 *    matching.
 *  - `missing`: saved ids the API had no coin for (delisted, renamed...), in the
 *    order they were saved, so they can be shown and removed instead of vanishing.
 */
export function matchWatchlist(ids: readonly string[], coins: readonly MarketCoin[]) {
  const watched = new Set(ids);
  const known = new Set(coins.map((c) => c.id));
  return {
    rows: coins.filter((c) => watched.has(c.id)),
    missing: ids.filter((id) => !known.has(id)),
  };
}
