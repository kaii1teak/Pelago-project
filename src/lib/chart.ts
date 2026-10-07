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

export const isChartRange = (value: unknown): value is ChartRange =>
  typeof value === "string" && (CHART_RANGES as readonly string[]).includes(value);

export const isChartMode = (value: unknown): value is ChartMode =>
  typeof value === "string" && (CHART_MODES as readonly string[]).includes(value);

/** CoinGecko coin ids: lowercase slugs. Anything else can't be a real coin. */
export const COIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/;
