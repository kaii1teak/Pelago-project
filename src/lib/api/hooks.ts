"use client";

import {
  keepPreviousData,
  useQueries,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiGet } from "./client";
import type { ApiError } from "./errors";
import { chunkIds, marketsUrl, type MarketsParams } from "./markets-query";
import { queryKeys } from "./query-keys";
import type { ChartRange } from "@/lib/chart";
import type {
  CoinDetail,
  GlobalStats,
  MarketCoin,
  OhlcChart,
  PriceChart,
  TrendingCoin,
} from "./schemas";

/** Poll interval for "live" numbers. Pauses automatically while the tab is hidden. */
export const LIVE_REFETCH_MS = 60_000;

export function useGlobalStats() {
  return useQuery<GlobalStats, ApiError>({
    queryKey: queryKeys.global,
    queryFn: ({ signal }) => apiGet<GlobalStats>("/api/global", { signal }),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useMarkets(
  params?: MarketsParams,
  options?: {
    /** Keep showing the previous result while new params load (no skeleton flash when switching filters). */
    keepPrevious?: boolean;
  },
) {
  return useQuery<MarketCoin[], ApiError>({
    queryKey: queryKeys.markets(params),
    queryFn: ({ signal }) => apiGet<MarketCoin[]>(marketsUrl(params), { signal }),
    refetchInterval: LIVE_REFETCH_MS,
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
  });
}

// useQueries types errors as plain Error; ApiError is what apiGet actually throws.
type MarketsResult = UseQueryResult<MarketCoin[], Error>;

// Module-level so its identity is stable: TanStack Query then re-runs it only when
// a result actually changes, not on every render.
function combineMarkets(results: MarketsResult[]) {
  return {
    /** Every chunk's coins, or undefined until ALL chunks have data. */
    data: results.every((r) => r.data)
      ? results.flatMap((r) => r.data as MarketCoin[])
      : undefined,
    isPending: results.some((r) => r.isPending),
    isError: results.some((r) => r.isError),
    error: results.find((r) => r.error)?.error ?? null,
    isFetching: results.some((r) => r.isFetching),
    refetch: () => {
      for (const r of results) void r.refetch();
    },
  };
}

/**
 * Live prices for a specific set of coins (the watchlist). The API takes at most
 * MAX_IDS per request and a list can be longer, so this splits it into as many
 * requests as needed and joins them. No ids, no requests.
 */
export function useMarketsByIds(ids: readonly string[]) {
  return useQueries({
    queries: chunkIds(ids).map((part) => ({
      queryKey: queryKeys.markets({ ids: part }),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiGet<MarketCoin[]>(marketsUrl({ ids: part }), { signal }),
      refetchInterval: LIVE_REFETCH_MS,
      placeholderData: keepPreviousData,
    })),
    combine: combineMarkets,
  });
}

export function useTrending() {
  return useQuery<TrendingCoin[], ApiError>({
    queryKey: queryKeys.trending,
    queryFn: ({ signal }) => apiGet<TrendingCoin[]>("/api/trending", { signal }),
    // The trending list only changes every few minutes; no need to poll hard.
    refetchInterval: 5 * LIVE_REFETCH_MS,
  });
}

export function useCoin(id: string) {
  return useQuery<CoinDetail, ApiError>({
    queryKey: queryKeys.coin(id),
    queryFn: ({ signal }) =>
      apiGet<CoinDetail>(`/api/coins/${encodeURIComponent(id)}`, { signal }),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

/** Recent ranges refresh; a year of daily prices doesn't need to. */
const CHART_REFETCH_MS: Record<ChartRange, number | false> = {
  "24h": LIVE_REFETCH_MS,
  "7d": 5 * LIVE_REFETCH_MS,
  "30d": false,
  "1y": false,
};

/** The one definition of "a coin's price chart", shared by the single and multi-coin hooks. */
const coinChartQuery = (id: string, range: ChartRange) => ({
  queryKey: queryKeys.coinChart(id, range),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    apiGet<PriceChart>(`/api/coins/${encodeURIComponent(id)}/chart?range=${range}`, {
      signal,
    }),
  refetchInterval: CHART_REFETCH_MS[range],
});

export function useCoinChart(id: string, range: ChartRange) {
  return useQuery<PriceChart, ApiError>({
    ...coinChartQuery(id, range),
    // Switching ranges keeps the old chart (dimmed) instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  });
}

type ChartResult = UseQueryResult<PriceChart, Error>;

// Module-level so its identity is stable (see combineMarkets).
function combineCharts(results: ChartResult[]) {
  return results.map((r) => ({
    data: r.data,
    isPending: r.isPending,
    isError: r.isError,
    error: r.error,
    isFetching: r.isFetching,
    refetch: () => void r.refetch(),
  }));
}

/**
 * Price charts for several coins at once (the comparison), in the order given.
 * No placeholder data on purpose: results are matched to coins by position, so
 * "keep the previous result" could show one coin's line under another's name
 * when the list changes.
 */
export function useCoinCharts(ids: readonly string[], range: ChartRange) {
  return useQueries({
    queries: ids.map((id) => coinChartQuery(id, range)),
    combine: combineCharts,
  });
}

/** Only fetched in candle mode: one extra upstream call a line-chart viewer never pays for. */
export function useCoinOhlc(id: string, range: ChartRange, enabled: boolean) {
  return useQuery<OhlcChart, ApiError>({
    queryKey: queryKeys.coinOhlc(id, range),
    queryFn: ({ signal }) =>
      apiGet<OhlcChart>(`/api/coins/${encodeURIComponent(id)}/ohlc?range=${range}`, {
        signal,
      }),
    enabled,
    refetchInterval: CHART_REFETCH_MS[range],
    placeholderData: keepPreviousData,
  });
}
