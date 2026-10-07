"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet } from "./client";
import type { ApiError } from "./errors";
import { marketsUrl, type MarketsParams } from "./markets-query";
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

export function useCoinChart(id: string, range: ChartRange) {
  return useQuery<PriceChart, ApiError>({
    queryKey: queryKeys.coinChart(id, range),
    queryFn: ({ signal }) =>
      apiGet<PriceChart>(`/api/coins/${encodeURIComponent(id)}/chart?range=${range}`, {
        signal,
      }),
    refetchInterval: CHART_REFETCH_MS[range],
    // Switching ranges keeps the old chart (dimmed) instead of flashing a skeleton.
    placeholderData: keepPreviousData,
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
