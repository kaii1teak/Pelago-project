import { priceDigits } from "@/lib/format";

/**
 * Turning CoinGecko's raw series into what the chart library needs.
 * Lightweight Charts has hard requirements that upstream data doesn't promise:
 * time in whole seconds, strictly ascending, no duplicates. A violation throws
 * inside the library ("data must be asc ordered by time"), so it's enforced here.
 */

export type LinePoint = { time: number; value: number };
export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Sort ascending by time and collapse duplicates, keeping the *latest* entry for a time. */
function ascendingUnique<T extends { time: number }>(items: T[]): T[] {
  const byTime = new Map<number, T>();
  for (const item of items) byTime.set(item.time, item);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** Rows of [timestampMs, price]. Non-finite values are dropped. */
export function toLineSeries(rows: readonly (readonly (number | null)[])[]): LinePoint[] {
  const points: LinePoint[] = [];
  for (const row of rows) {
    const [ms, value] = row;
    if (isNum(ms) && isNum(value)) points.push({ time: Math.floor(ms / 1000), value });
  }
  return ascendingUnique(points);
}

/** Rows of [timestampMs, open, high, low, close]. Incomplete rows are dropped. */
export function toCandleSeries(rows: readonly (readonly (number | null)[])[]): Candle[] {
  const candles: Candle[] = [];
  for (const row of rows) {
    const [ms, open, high, low, close] = row;
    if (isNum(ms) && isNum(open) && isNum(high) && isNum(low) && isNum(close)) {
      candles.push({ time: Math.floor(ms / 1000), open, high, low, close });
    }
  }
  return ascendingUnique(candles);
}

export type SeriesSummary = {
  first: number;
  last: number;
  high: number;
  low: number;
  /** Percent change first -> last. */
  change: number;
};

/** Open/close/high/low of a line series, for the caption under the chart. */
export function summarizeLine(points: readonly LinePoint[]): SeriesSummary | null {
  if (points.length === 0) return null;
  let high = -Infinity;
  let low = Infinity;
  for (const p of points) {
    if (p.value > high) high = p.value;
    if (p.value < low) low = p.value;
  }
  const first = points[0]!.value;
  const last = points[points.length - 1]!.value;
  return {
    first,
    last,
    high,
    low,
    change: first === 0 ? 0 : ((last - first) / first) * 100,
  };
}

export function summarizeCandles(candles: readonly Candle[]): SeriesSummary | null {
  if (candles.length === 0) return null;
  let high = -Infinity;
  let low = Infinity;
  for (const c of candles) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  const first = candles[0]!.open;
  const last = candles[candles.length - 1]!.close;
  return {
    first,
    last,
    high,
    low,
    change: first === 0 ? 0 : ((last - first) / first) * 100,
  };
}

/**
 * Smallest price step the axis should show, so a $0.00001234 coin isn't
 * rounded to $0.00 and a $83,000 coin doesn't get eight decimals.
 */
export function priceMinMove(price: number) {
  // Built from a literal: 10 ** -4 is 0.00009999999999999999 in JS floating point.
  return Number(`1e-${priceDigits(price)}`);
}
