import { z } from "zod";
import { toCandleSeries, toLineSeries } from "@/lib/chart-data";
import { htmlToParagraphs } from "@/lib/sanitize";
import { downsample } from "@/lib/series";
import { safeUrl } from "@/lib/url";

/**
 * Runtime validation for CoinGecko responses. Each schema also *reshapes* the
 * payload: the rest of the app only ever sees these lean, null-safe types, never
 * CoinGecko's raw field names. Unknown fields are stripped by zod's default.
 */

// CoinGecko returns null for anything it hasn't computed yet (new listings etc.).
const nullableNumber = z
  .number()
  .nullish()
  .transform((v) => v ?? null);

const SPARKLINE_POINTS = 42;

/* ---- /global ------------------------------------------------------------- */

// Deliberately NOT mapped: `total_volume`. As of Oct 2026 the endpoint reports
// it at ~25x the entire market cap ($73T vs $2.9T), while the 24h volumes of the
// top 100 coins sum to ~$123B. Don't re-add it: derive market volume from the
// /coins/markets data instead.

export const globalStatsSchema = z
  .object({
    data: z.object({
      active_cryptocurrencies: z.number(),
      markets: z.number(),
      total_market_cap: z.object({ usd: z.number() }),
      market_cap_percentage: z.record(z.string(), z.number()),
      market_cap_change_percentage_24h_usd: nullableNumber,
      updated_at: z.number(),
    }),
  })
  .transform(({ data }) => ({
    totalMarketCap: data.total_market_cap.usd,
    btcDominance: data.market_cap_percentage.btc ?? null,
    ethDominance: data.market_cap_percentage.eth ?? null,
    marketCapChange24h: data.market_cap_change_percentage_24h_usd,
    activeCryptocurrencies: data.active_cryptocurrencies,
    markets: data.markets,
    /** Unix seconds, as reported by CoinGecko. */
    updatedAt: data.updated_at,
  }));
export type GlobalStats = z.output<typeof globalStatsSchema>;

/* ---- /coins/markets ------------------------------------------------------ */

export const marketCoinSchema = z
  .object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    image: z
      .string()
      .nullish()
      .transform((v) => v ?? null),
    current_price: nullableNumber,
    market_cap: nullableNumber,
    market_cap_rank: nullableNumber,
    total_volume: nullableNumber,
    high_24h: nullableNumber,
    low_24h: nullableNumber,
    circulating_supply: nullableNumber,
    price_change_percentage_24h: nullableNumber,
    price_change_percentage_1h_in_currency: nullableNumber,
    price_change_percentage_24h_in_currency: nullableNumber,
    price_change_percentage_7d_in_currency: nullableNumber,
    sparkline_in_7d: z.object({ price: z.array(z.number()) }).nullish(),
  })
  .transform((raw) => ({
    id: raw.id,
    symbol: raw.symbol.toUpperCase(),
    name: raw.name,
    image: raw.image,
    price: raw.current_price,
    marketCap: raw.market_cap,
    rank: raw.market_cap_rank,
    volume24h: raw.total_volume,
    high24h: raw.high_24h,
    low24h: raw.low_24h,
    circulatingSupply: raw.circulating_supply,
    change1h: raw.price_change_percentage_1h_in_currency,
    change24h:
      raw.price_change_percentage_24h_in_currency ?? raw.price_change_percentage_24h,
    change7d: raw.price_change_percentage_7d_in_currency,
    sparkline: downsample(raw.sparkline_in_7d?.price ?? [], SPARKLINE_POINTS),
  }));
export type MarketCoin = z.output<typeof marketCoinSchema>;

export const marketsSchema = z.array(marketCoinSchema);

/* ---- /coins/markets, as the heatmap needs it ------------------------------ */

// The same endpoint, asked without sparklines (the heatmap draws none, and they are most of
// the payload) and cut down to what a cell shows. Parsed by the markets schema so a
// malformed coin is handled in one place; MarketCoin satisfies HeatCoin, so the home
// preview can feed rows it already has.
export type HeatCoin = Pick<
  MarketCoin,
  | "id"
  | "symbol"
  | "name"
  | "image"
  | "rank"
  | "price"
  | "marketCap"
  | "volume24h"
  | "change1h"
  | "change24h"
  | "change7d"
>;

export const heatmapSchema = marketsSchema.transform((coins): HeatCoin[] =>
  coins.map((c) => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    image: c.image,
    rank: c.rank,
    price: c.price,
    marketCap: c.marketCap,
    volume24h: c.volume24h,
    change1h: c.change1h,
    change24h: c.change24h,
    change7d: c.change7d,
  })),
);

/* ---- /search/trending ---------------------------------------------------- */

// Lenient on purpose: older versions of this endpoint returned display strings
// ("$67,000") for price fields. One odd value must not blank the whole list, so
// anything that isn't a finite number becomes null instead of failing the parse.
const looseNumber = z
  .unknown()
  .optional()
  .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));

export const trendingSchema = z
  .object({
    coins: z.array(
      z.object({
        item: z.object({
          id: z.string(),
          name: z.string(),
          symbol: z.string(),
          market_cap_rank: looseNumber,
          small: z
            .string()
            .nullish()
            .transform((v) => v ?? null),
          data: z
            .object({
              price: looseNumber,
              price_change_percentage_24h: z.object({ usd: looseNumber }).nullish(),
            })
            .nullish(),
        }),
      }),
    ),
  })
  .transform(({ coins }) =>
    coins.map(({ item }) => ({
      id: item.id,
      name: item.name,
      symbol: item.symbol.toUpperCase(),
      rank: item.market_cap_rank,
      image: item.small,
      price: item.data?.price ?? null,
      change24h: item.data?.price_change_percentage_24h?.usd ?? null,
    })),
  );
export type TrendingCoin = z.output<typeof trendingSchema>[number];

/* ---- /search -------------------------------------------------------------- */

/** How many matches the palette ever shows. */
export const MAX_SEARCH_RESULTS = 8;

/**
 * Only `coins` is read (the response also lists exchanges, categories, NFTs...).
 * Kept lean: the palette needs a name, a symbol, a rank for ordering and a logo.
 */
export const searchSchema = z
  .object({
    coins: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        symbol: z.string(),
        market_cap_rank: looseNumber,
        large: z
          .string()
          .nullish()
          .transform((v) => v ?? null),
      }),
    ),
  })
  .transform(({ coins }) =>
    coins.slice(0, MAX_SEARCH_RESULTS).map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      rank: c.market_cap_rank,
      image: c.large,
    })),
  );
export type SearchResult = z.output<typeof searchSchema>[number];

/* ---- /coins/{id} ---------------------------------------------------------- */

// Most market fields arrive as {usd: n, eur: n, ...} dictionaries; only USD is used.
const usdNumber = z
  .object({ usd: nullableNumber })
  .nullish()
  .transform((v) => v?.usd ?? null);
const usdString = z
  .object({ usd: z.string().nullish() })
  .nullish()
  .transform((v) => v?.usd ?? null);

const urlList = (max: number) =>
  z
    .array(z.unknown())
    .nullish()
    .transform((list) =>
      [...new Set((list ?? []).map(safeUrl).filter((u): u is string => !!u))].slice(
        0,
        max,
      ),
    );

const firstUrl = z
  .array(z.unknown())
  .nullish()
  .transform((list) => (list ?? []).map(safeUrl).find((u): u is string => !!u) ?? null);

const TWITTER_HANDLE = /^[A-Za-z0-9_]{1,15}$/;

export const coinDetailSchema = z
  .object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    image: z
      .object({ large: z.string().nullish() })
      .nullish()
      .transform((v) => v?.large ?? null),
    market_cap_rank: nullableNumber,
    description: z
      .object({ en: z.string().nullish() })
      .nullish()
      .transform((v) => htmlToParagraphs(v?.en)),
    categories: z
      .array(z.string().nullable())
      .nullish()
      .transform((list) => (list ?? []).filter((c): c is string => !!c).slice(0, 8)),
    genesis_date: z
      .string()
      .nullish()
      .transform((v) => v ?? null),
    links: z
      .object({
        homepage: firstUrl,
        whitepaper: z
          .unknown()
          .optional()
          .transform((v) => safeUrl(v)),
        blockchain_site: urlList(3),
        official_forum_url: firstUrl,
        subreddit_url: z
          .unknown()
          .optional()
          .transform((v) => safeUrl(v)),
        twitter_screen_name: z
          .string()
          .nullish()
          .transform((h) => (h && TWITTER_HANDLE.test(h) ? `https://x.com/${h}` : null)),
        repos_url: z
          .object({ github: firstUrl })
          .nullish()
          .transform((v) => v?.github ?? null),
      })
      .nullish(),
    market_data: z
      .object({
        current_price: usdNumber,
        market_cap: usdNumber,
        fully_diluted_valuation: usdNumber,
        total_volume: usdNumber,
        high_24h: usdNumber,
        low_24h: usdNumber,
        price_change_percentage_24h: nullableNumber,
        price_change_percentage_7d: nullableNumber,
        price_change_percentage_30d: nullableNumber,
        price_change_percentage_1y: nullableNumber,
        ath: usdNumber,
        ath_date: usdString,
        ath_change_percentage: usdNumber,
        atl: usdNumber,
        atl_date: usdString,
        atl_change_percentage: usdNumber,
        circulating_supply: nullableNumber,
        total_supply: nullableNumber,
        max_supply: nullableNumber,
        last_updated: z
          .string()
          .nullish()
          .transform((v) => v ?? null),
      })
      .nullish(),
  })
  .transform((raw) => {
    const m = raw.market_data;
    const l = raw.links;
    return {
      id: raw.id,
      symbol: raw.symbol.toUpperCase(),
      name: raw.name,
      image: raw.image,
      rank: raw.market_cap_rank,
      description: raw.description,
      categories: raw.categories,
      genesisDate: raw.genesis_date,
      links: {
        website: l?.homepage ?? null,
        whitepaper: l?.whitepaper ?? null,
        explorers: l?.blockchain_site ?? [],
        forum: l?.official_forum_url ?? null,
        reddit: l?.subreddit_url ?? null,
        twitter: l?.twitter_screen_name ?? null,
        github: l?.repos_url ?? null,
      },
      market: {
        price: m?.current_price ?? null,
        marketCap: m?.market_cap ?? null,
        fdv: m?.fully_diluted_valuation ?? null,
        volume24h: m?.total_volume ?? null,
        high24h: m?.high_24h ?? null,
        low24h: m?.low_24h ?? null,
        change24h: m?.price_change_percentage_24h ?? null,
        change7d: m?.price_change_percentage_7d ?? null,
        change30d: m?.price_change_percentage_30d ?? null,
        change1y: m?.price_change_percentage_1y ?? null,
        ath: m?.ath ?? null,
        athDate: m?.ath_date ?? null,
        athChange: m?.ath_change_percentage ?? null,
        atl: m?.atl ?? null,
        atlDate: m?.atl_date ?? null,
        atlChange: m?.atl_change_percentage ?? null,
        circulatingSupply: m?.circulating_supply ?? null,
        totalSupply: m?.total_supply ?? null,
        maxSupply: m?.max_supply ?? null,
        updatedAt: m?.last_updated ?? null,
      },
    };
  });
export type CoinDetail = z.output<typeof coinDetailSchema>;

/* ---- /coins/{id}/market_chart and /ohlc ----------------------------------- */

const seriesRows = z.array(z.array(z.number().nullable()));

/** market_chart returns prices/market_caps/total_volumes; only prices are charted. */
export const priceChartSchema = z
  .object({ prices: seriesRows })
  .transform(({ prices }) => toLineSeries(prices));
export type PriceChart = z.output<typeof priceChartSchema>;

export const ohlcSchema = seriesRows.transform((rows) => toCandleSeries(rows));
export type OhlcChart = z.output<typeof ohlcSchema>;
