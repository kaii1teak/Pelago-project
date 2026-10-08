/**
 * Shared (browser + server) vocabulary for the asset chart. Dependency-free so
 * client code can import it without pulling in zod or the charting library.
 */

export const CHART_RANGES = ["24h", "7d", "30d", "1y"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];
export const DEFAULT_RANGE: ChartRange = "7d";

/** CoinGecko's `days` parameter per range. 1y is the free tier's maximum history. */
export const CHART_DAYS: Record<ChartRange, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "1y": 365,
};

/** For screen readers and tooltips: "7d" -> "7 days". */
export const RANGE_NAME: Record<ChartRange, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  "1y": "1 year",
};

export const CHART_MODES = ["line", "candle"] as const;
export type ChartMode = (typeof CHART_MODES)[number];
export const DEFAULT_MODE: ChartMode = "line";

/** What the price axis shows: dollars, or percent change from the first bar on screen. */
export const CHART_SCALES = ["price", "percent"] as const;
export type ChartScale = (typeof CHART_SCALES)[number];
export const DEFAULT_SCALE: ChartScale = "price";

export const isChartScale = (value: unknown): value is ChartScale =>
  typeof value === "string" && (CHART_SCALES as readonly string[]).includes(value);

export const isChartRange = (value: unknown): value is ChartRange =>
  typeof value === "string" && (CHART_RANGES as readonly string[]).includes(value);

export const isChartMode = (value: unknown): value is ChartMode =>
  typeof value === "string" && (CHART_MODES as readonly string[]).includes(value);

/** CoinGecko coin ids: lowercase slugs. Anything else can't be a real coin. */
export const COIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/;

/* ---- Scrolling back in time ---------------------------------------------- */

/**
 * The free API serves a year of history, and refuses a request that starts even a
 * day further back (HTTP 401). We stop a day short, so rounding times to the hour
 * can never push a request over that edge.
 */
export const HISTORY_DAYS = 364;

/**
 * How much older data one step back loads. Short ranges load a week at a time: a
 * day per request would use up the rate limit after a few seconds of scrolling.
 */
export const CHUNK_DAYS: Record<ChartRange, number> = {
  "24h": 7,
  "7d": 7,
  "30d": 30,
  "1y": HISTORY_DAYS,
};

/** How many steps back there are for a range (the 1y chart already holds all the history there is). */
export function maxBack(range: ChartRange): number {
  if (range === "1y") return 0;
  return Math.floor((HISTORY_DAYS - CHART_DAYS[range]) / CHUNK_DAYS[range]);
}

export const isChartBack = (value: unknown, range: ChartRange): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= maxBack(range);

/**
 * The window (unix seconds) that step `back` (1, 2, ...) loads: the stretch right
 * before the chart's own window, then before that one, and so on. `nowSec` is
 * rounded down to the hour, so the window (and the cache entry it becomes) only
 * changes once an hour, however many people scroll.
 */
export function historyWindow(range: ChartRange, back: number, nowSec: number) {
  const hour = Math.floor(nowSec / 3600) * 3600;
  const to = hour - (CHART_DAYS[range] + (back - 1) * CHUNK_DAYS[range]) * 86_400;
  return { from: to - CHUNK_DAYS[range] * 86_400, to };
}
