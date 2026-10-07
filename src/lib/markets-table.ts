import type { MarketCoin } from "@/lib/api/schemas";
import { directionOf } from "@/lib/format";

export const PAGE_SIZE = 25;

export const SORT_KEYS = [
  "rank",
  "name",
  "price",
  "change1h",
  "change24h",
  "change7d",
  "marketCap",
  "volume",
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export const VIEWS = ["all", "gainers", "losers"] as const;
export type MoversView = (typeof VIEWS)[number];

/** Which way a column sorts the first time it's clicked. */
export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  rank: "asc",
  name: "asc",
  price: "desc",
  change1h: "desc",
  change24h: "desc",
  change7d: "desc",
  marketCap: "desc",
  volume: "desc",
};

const VALUE: Record<Exclude<SortKey, "name">, (c: MarketCoin) => number | null> = {
  rank: (c) => c.rank,
  price: (c) => c.price,
  change1h: (c) => c.change1h,
  change24h: (c) => c.change24h,
  change7d: (c) => c.change7d,
  marketCap: (c) => c.marketCap,
  volume: (c) => c.volume24h,
};

/** Missing ranks sort after every real rank, so tie-breaking never puts unknowns first. */
const rankOf = (c: MarketCoin) => c.rank ?? Number.POSITIVE_INFINITY;

/**
 * Sort without mutating the input. Coins with no value for the column always
 * go last, in either direction: "sort by 7d change, worst first" must not open
 * with a screenful of coins that simply have no data. Ties fall back to rank
 * so the order is stable and doesn't shuffle between refreshes.
 */
export function sortCoins(coins: readonly MarketCoin[], key: SortKey, dir: SortDir) {
  const sign = dir === "asc" ? 1 : -1;
  return [...coins].sort((a, b) => {
    if (key === "name") {
      const byName = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
      return byName !== 0 ? byName * sign : rankOf(a) - rankOf(b);
    }
    const av = VALUE[key](a);
    const bv = VALUE[key](b);
    if (av === null && bv === null) return rankOf(a) - rankOf(b);
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av !== bv) return (av - bv) * sign;
    return rankOf(a) - rankOf(b);
  });
}

export function filterCoins(
  coins: readonly MarketCoin[],
  { q, view }: { q: string; view: MoversView },
) {
  const needle = q.trim().toLowerCase();
  return coins.filter((c) => {
    // Same rounding the table displays: a +0.004% coin shows as "0.00%", so it is not a gainer.
    if (view === "gainers" && directionOf(c.change24h) !== "up") return false;
    if (view === "losers" && directionOf(c.change24h) !== "down") return false;
    if (!needle) return true;
    return (
      c.name.toLowerCase().includes(needle) || c.symbol.toLowerCase().includes(needle)
    );
  });
}

export function pageCountFor(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export function paginate<T>(items: readonly T[], page: number) {
  const pageCount = pageCountFor(items.length);
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * PAGE_SIZE;
  return {
    items: items.slice(start, start + PAGE_SIZE),
    page: current,
    pageCount,
    /** 1-based, inclusive range shown, for "Showing 26-50 of 97". */
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + PAGE_SIZE, items.length),
    total: items.length,
  };
}
