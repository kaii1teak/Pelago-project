/**
 * Which of our coins have a live price, and what that price may be trusted for.
 * CoinGecko and Binance don't share ids, only tickers, and tickers are not unique, so a
 * match by ticker is a guess that gets checked.
 */

/** Beyond the top 300 by market cap, a ticker is as likely to belong to a different coin as to this one. */
export const MAX_LIVE_RANK = 300;

/** A live price further than this from the polled one is a different asset with the same ticker. */
export const MAX_DEVIATION = 0.1;

/** What the streams need to know about a coin: its ticker, rank, and the price it was last polled at. */
export type LiveSource = {
  symbol: string;
  rank: number | null;
  price: number | null;
  /** The 24-hour change in percent that came with `price`. */
  change24h?: number | null;
};

/** "BTC" -> "BTCUSDT". Null for a ticker that can't be a Binance symbol or a coin too small to trust. */
export function liveSymbol(symbol: string, rank?: number | null): string | null {
  const base = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,12}$/.test(base)) return null;
  if (rank != null && rank > MAX_LIVE_RANK) return null;
  return `${base}USDT`;
}

/** Whether a streamed price is plausibly the same coin as the polled one. With nothing to compare to, it is accepted. */
export function isPlausible(live: number, reference: number | null | undefined): boolean {
  if (!Number.isFinite(live) || live <= 0) return false;
  if (reference == null || !Number.isFinite(reference) || reference <= 0) return true;
  return Math.abs(live / reference - 1) <= MAX_DEVIATION;
}

/**
 * The 24-hour change at a live price, on CoinGecko's own definition: the polled price and
 * polled change imply the price a day ago, and the live price is measured from that. (Not
 * Binance's own 24h open, which would make the number disagree with the rest of the row.)
 */
export function liveChange24h(
  live: number,
  polledPrice: number | null | undefined,
  polledChange: number | null | undefined,
): number | null {
  if (polledPrice == null || polledChange == null) return null;
  if (!(polledPrice > 0) || polledChange <= -100) return null;
  const dayAgo = polledPrice / (1 + polledChange / 100);
  return (live / dayAgo - 1) * 100;
}
