import {
  COIN_ID_PATTERN,
  DEFAULT_RANGE,
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
