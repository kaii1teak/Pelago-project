import {
  COIN_ID_PATTERN,
  DEFAULT_RANGE,
  isChartBack,
  isChartRange,
  type ChartRange,
} from "@/lib/chart";
import { ApiError } from "./errors";

/**
 * A malformed coin id can't exist, so it's a plain "not found" and never
 * reaches the upstream (ids go into an upstream URL and double as cache keys).
 */
export function parseCoinId(raw: string): string {
  if (!COIN_ID_PATTERN.test(raw)) throw new ApiError("not_found");
  return raw;
}

export function parseChartRange(searchParams: URLSearchParams): ChartRange {
  const raw = searchParams.get("range");
  if (raw === null) return DEFAULT_RANGE;
  if (!isChartRange(raw)) throw new ApiError("bad_request");
  return raw;
}

/**
 * How many steps back in time, 0 (the default) for the chart's own window. It decides
 * the upstream window and so the cache key, hence the hard bounds: anything that is
 * not a whole number from 1 up to what the range allows is a bad request.
 */
export function parseChartBack(searchParams: URLSearchParams, range: ChartRange): number {
  const raw = searchParams.get("back");
  if (raw === null) return 0;
  const value = /^\d{1,3}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!isChartBack(value, range)) throw new ApiError("bad_request");
  return value;
}
