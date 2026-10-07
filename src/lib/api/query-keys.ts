import type { ChartRange } from "@/lib/chart";
import { normalizeMarketsParams, type MarketsParams } from "./markets-query";

/**
 * One place for every TanStack Query key. Identical keys are what de-duplicate
 * requests and share cache entries across components, so they must never be
 * typed inline.
 */
export const queryKeys = {
  global: ["global"] as const,
  trending: ["trending"] as const,
  coin: (id: string) => ["coin", id] as const,
  coinChart: (id: string, range: ChartRange) => ["coin", id, "chart", range] as const,
  coinOhlc: (id: string, range: ChartRange) => ["coin", id, "ohlc", range] as const,
  // Normalized, so ids in a different order still hit the same cache entry.
  markets: (params?: MarketsParams) =>
    ["markets", normalizeMarketsParams(params)] as const,
};
