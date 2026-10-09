"use client";

import {
  keepPreviousData,
  useQueries,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { apiGet } from "./client";
import type { ApiError } from "./errors";
import { chunkIds, marketsUrl, type MarketsParams } from "./markets-query";
import { MIN_QUERY_LENGTH } from "./parse-search";
import { queryKeys } from "./query-keys";
import { maxBack, type ChartRange } from "@/lib/chart";
import { mergeLineSeries } from "@/lib/chart-data";
import type {
  CoinDetail,
  GlobalStats,
  HeatCoin,
  MarketCoin,
  OhlcChart,
  PriceChart,
  SearchResult,
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

/**
 * Assets matching a search, from the whole market (not just the top 100). `query`
 * must be normalized (normalizeSearchText) and is only requested once it is long
 * enough: a one-letter search would match half the market and cost an upstream call.
 */
export function useSearch(query: string) {
  return useQuery<SearchResult[], ApiError>({
    queryKey: queryKeys.search(query),
    queryFn: ({ signal }) =>
      apiGet<SearchResult[]>(`/api/search?q=${encodeURIComponent(query)}`, { signal }),
    enabled: query.length >= MIN_QUERY_LENGTH,
    // Typing changes the key on every pause; keep the last answer on screen until the next lands.
    placeholderData: keepPreviousData,
    // Names and ranks barely move: no reason to ask again for the same text soon.
    staleTime: 5 * LIVE_REFETCH_MS,
    gcTime: 5 * 60_000,
  });
}

/**
 * The heatmap's coins: the top 200 of a category (or of the whole market), with every
 * period's change. One request serves every universe, period and size, since those only
 * choose what to draw from it. Changing category keeps the old picture on screen until the
 * new one arrives (`isPlaceholderData` says which it is), so cells morph instead of blanking.
 */
export function useHeatmap(category: string | null) {
  return useQuery<HeatCoin[], ApiError>({
    queryKey: queryKeys.heatmap(category),
    queryFn: ({ signal }) =>
      apiGet<HeatCoin[]>(
        category
          ? `/api/heatmap?category=${encodeURIComponent(category)}`
          : "/api/heatmap",
        { signal },
      ),
    refetchInterval: LIVE_REFETCH_MS,
    placeholderData: keepPreviousData,
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

/**
 * The one definition of "a coin's price chart", shared by the single and multi-coin
 * hooks. `back` (1, 2, ...) asks for the stretch of history before the chart's own
 * window; that part never changes, so it is neither polled nor quickly stale.
 */
const coinChartQuery = (id: string, range: ChartRange, back = 0) => ({
  queryKey: queryKeys.coinChart(id, range, back),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    apiGet<PriceChart>(
      `/api/coins/${encodeURIComponent(id)}/chart?range=${range}${back ? `&back=${back}` : ""}`,
      { signal },
    ),
  refetchInterval: back === 0 ? CHART_REFETCH_MS[range] : (false as const),
  ...(back > 0 && { staleTime: 30 * 60_000 }),
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

/**
 * A coin's price history for scrolling back through time. It starts with the chart's
 * own window (what the timeframe says) and grows one older stretch at a time, on
 * request (`loadOlder`), until the history the free API serves runs out. Picking
 * another coin or timeframe, or `reset()`, starts again from the latest window.
 *
 * `data` is everything loaded so far, joined into one ascending series.
 */
export function useCoinChartHistory(id: string, range: ChartRange, enabled = true) {
  const key = `${id}:${range}`;
  const [state, setState] = useState({ key, steps: 0 });
  // Adjusting state while rendering (rather than in an effect) avoids a frame of
  // the old coin's older data under the new coin's name.
  if (state.key !== key) setState({ key, steps: 0 });
  const steps = state.key === key ? state.steps : 0;

  const base = useQuery<PriceChart, ApiError>({
    ...coinChartQuery(id, range),
    placeholderData: keepPreviousData,
    enabled,
  });
  const older = useQueries({
    queries: Array.from({ length: steps }, (_, i) => ({
      ...coinChartQuery(id, range, i + 1),
      enabled,
    })),
    combine: combineCharts,
  });

  const limit = enabled ? maxBack(range) : 0;
  const loadingOlder = older.some((q) => q.isPending);
  const failed = older.find((q) => q.isError);

  const data = useMemo(
    () =>
      base.data
        ? mergeLineSeries([base.data, ...older.map((q) => q.data ?? [])])
        : undefined,
    [base.data, older],
  );

  const loadOlder = useCallback(() => {
    setState((s) =>
      s.key !== key || loadingOlder || failed || s.steps >= limit
        ? s
        : { key, steps: s.steps + 1 },
    );
  }, [key, loadingOlder, failed, limit]);

  return {
    /** The chart's own window, on its own: what the timeframe's summary should describe. */
    base,
    /** Everything loaded so far, joined. */
    data,
    /** More history exists beyond what is loaded. */
    hasMore: steps < limit,
    /** Scrolled back as far as the history goes (so the left edge can stop there). */
    reachedStart: limit > 0 && steps >= limit && !loadingOlder,
    loadingOlder,
    /** The older stretch that failed to load, if one did; call to try again. */
    olderError: failed ? { retry: failed.refetch } : null,
    loadOlder,
    /** Forget the older history and go back to the latest window. */
    reset: useCallback(() => setState({ key, steps: 0 }), [key]),
  };
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
