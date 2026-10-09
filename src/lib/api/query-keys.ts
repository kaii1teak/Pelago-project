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
  heatmap: (category: string | null = null) => ["heatmap", category] as const,
  search: (query: string) => ["search", query] as const,
  coin: (id: string) => ["coin", id] as const,
  // `back` (1, 2, ...) is the stretch of history before the chart's own window.
  coinChart: (id: string, range: ChartRange, back = 0) =>
    (back === 0
      ? ["coin", id, "chart", range]
      : ["coin", id, "chart", range, back]) as readonly unknown[],
  coinOhlc: (id: string, range: ChartRange) => ["coin", id, "ohlc", range] as const,
  // Normalized, so ids in a different order still hit the same cache entry.
  markets: (params?: MarketsParams) =>
    ["markets", normalizeMarketsParams(params)] as const,
};
