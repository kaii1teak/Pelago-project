import "server-only";
import { cgFetch } from "./coingecko";
import type { MarketsParams } from "./markets-query";
import { CHART_DAYS, historyWindow, type ChartRange } from "@/lib/chart";
import {
  coinDetailSchema,
  globalStatsSchema,
  marketsSchema,
  ohlcSchema,
  priceChartSchema,
  searchSchema,
  trendingSchema,
} from "./schemas";

/**
 * Cache windows (seconds) per endpoint, chosen against CoinGecko's free-tier
 * limits. CoinGecko itself only refreshes most of this data every 1 to 5
 * minutes, so shorter windows would burn quota without fresher numbers.
 */
export const REVALIDATE = {
  global: 120,
  markets: 60,
  trending: 300,
  coin: 120,
  search: 300,
} as const;

/** Used by both route handlers (for the browser) and server components (for first paint). */
export function getGlobalStats() {
  return cgFetch("/global", globalStatsSchema, {
    revalidate: REVALIDATE.global,
    tags: ["global"],
  });
}

export type MarketsQuery = MarketsParams & {
  order?: "market_cap_desc" | "volume_desc" | "market_cap_asc";
};

export function getMarkets({
  page = 1,
  perPage = 100,
  ids,
  category,
  order = "market_cap_desc",
}: MarketsQuery = {}) {
  return cgFetch("/coins/markets", marketsSchema, {
    params: {
      vs_currency: "usd",
      order,
      per_page: perPage,
      page,
      sparkline: true,
      price_change_percentage: "1h,24h,7d",
      // Sorted: the same set of coins must hit the same cache entry.
      ids: ids && [...ids].sort().join(","),
      category,
    },
    revalidate: REVALIDATE.markets,
    tags: ["markets"],
  });
}

export function getTrending() {
  return cgFetch("/search/trending", trendingSchema, {
    revalidate: REVALIDATE.trending,
    tags: ["trending"],
  });
}

/** `query` must already be normalized (see parseSearchQuery): it is the cache key. */
export function getSearch(query: string) {
  return cgFetch("/search", searchSchema, {
    params: { query },
    revalidate: REVALIDATE.search,
    tags: ["search"],
  });
}

/** Chart history changes slowly, so longer ranges are cached longer. */
export const CHART_REVALIDATE: Record<ChartRange, number> = {
  "24h": 120,
  "7d": 600,
  "30d": 1800,
  "1y": 3600,
};

/** Everything the asset page needs about one coin. ids are validated by the caller. */
export function getCoin(id: string) {
  return cgFetch(`/coins/${encodeURIComponent(id)}`, coinDetailSchema, {
    params: {
      // The default response is huge (tickers, localized text, dev stats); none of it is used.
      localization: false,
      tickers: false,
      community_data: false,
      developer_data: false,
      sparkline: false,
    },
    revalidate: REVALIDATE.coin,
    tags: ["coin"],
  });
}

/** Older stretches of history never change, so they are cached much longer than the live window. */
export const HISTORY_REVALIDATE = 3600;

/**
 * The chart's own window (`back` = 0), or, for `back` = 1, 2, ..., the stretch just
 * before it, then before that: what scrolling the chart backwards loads. Both come
 * back in the same shape, so the client can simply join them.
 */
export function getCoinChart(id: string, range: ChartRange, back = 0) {
  const path = `/coins/${encodeURIComponent(id)}`;
  if (back === 0) {
    return cgFetch(`${path}/market_chart`, priceChartSchema, {
      params: { vs_currency: "usd", days: CHART_DAYS[range] },
      revalidate: CHART_REVALIDATE[range],
      tags: ["coin-chart"],
    });
  }
  const { from, to } = historyWindow(range, back, Date.now() / 1000);
  return cgFetch(`${path}/market_chart/range`, priceChartSchema, {
    params: { vs_currency: "usd", from, to },
    revalidate: HISTORY_REVALIDATE,
    tags: ["coin-chart"],
  });
}

export function getCoinOhlc(id: string, range: ChartRange) {
  return cgFetch(`/coins/${encodeURIComponent(id)}/ohlc`, ohlcSchema, {
    params: { vs_currency: "usd", days: CHART_DAYS[range] },
    revalidate: CHART_REVALIDATE[range],
    tags: ["coin-ohlc"],
  });
}
