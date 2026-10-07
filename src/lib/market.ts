import type { MarketCoin } from "@/lib/api/schemas";
import { directionOf } from "@/lib/format";

/**
 * Biggest 24h movers among the given coins. Coins with no 24h change are
 * ignored, and a coin only counts as a gainer/loser if it visibly moved
 * (a +0.004% coin is displayed as 0.00%, so it isn't listed as a gainer).
 */
export function topMovers(coins: readonly MarketCoin[], count: number) {
  const withChange = coins.filter(
    (c): c is MarketCoin & { change24h: number } =>
      c.change24h !== null && Number.isFinite(c.change24h),
  );
  const gainers = withChange
    .filter((c) => directionOf(c.change24h) === "up")
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, count);
  const losers = withChange
    .filter((c) => directionOf(c.change24h) === "down")
    .sort((a, b) => a.change24h - b.change24h)
    .slice(0, count);
  return { gainers, losers };
}

/**
 * Combined 24h trading volume of the given coins. We derive market volume
 * from the markets data because CoinGecko's /global volume field is unreliable
 * (see schemas.ts). Missing volumes count as zero.
 */
export function sumVolume(coins: readonly MarketCoin[]) {
  return coins.reduce((total, c) => total + (c.volume24h ?? 0), 0);
}

/** Up/down/flat over the 7-day sparkline, for coloring it. */
export function sparklineTrend(sparkline: readonly number[]): "up" | "down" | "flat" {
  if (sparkline.length < 2) return "flat";
  const first = sparkline[0]!;
  const last = sparkline[sparkline.length - 1]!;
  if (last > first) return "up";
  if (last < first) return "down";
  return "flat";
}
