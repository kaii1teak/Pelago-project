import type { MarketCoin } from "@/lib/api/schemas";

/** Trimmed-down but structurally faithful CoinGecko responses. */

export const globalFixture = {
  data: {
    active_cryptocurrencies: 17432,
    upcoming_icos: 0,
    ongoing_icos: 49,
    ended_icos: 3376,
    markets: 1245,
    total_market_cap: { usd: 2_410_000_000_000, eur: 2_200_000_000_000 },
    total_volume: { usd: 84_200_000_000, eur: 77_000_000_000 },
    market_cap_percentage: { btc: 52.41, eth: 17.08, usdt: 4.1 },
    market_cap_change_percentage_24h_usd: -1.2345,
    updated_at: 1_759_700_000,
  },
};

const hourly = Array.from({ length: 168 }, (_, i) => 100 + i);

export const marketsFixture = [
  {
    id: "bitcoin",
    symbol: "btc",
    name: "Bitcoin",
    image: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
    current_price: 67432.12,
    market_cap: 1_330_000_000_000,
    market_cap_rank: 1,
    total_volume: 31_000_000_000,
    high_24h: 68000,
    low_24h: 66500,
    circulating_supply: 19_700_000,
    price_change_percentage_24h: 1.5,
    price_change_percentage_1h_in_currency: 0.12,
    price_change_percentage_24h_in_currency: 1.48,
    price_change_percentage_7d_in_currency: -2.3,
    sparkline_in_7d: { price: hourly },
    // Extra fields CoinGecko sends that we deliberately don't keep:
    ath: 73738,
    roi: null,
  },
  {
    // A brand-new listing: CoinGecko returns nulls for most computed fields.
    id: "newcoin",
    symbol: "new",
    name: "New Coin",
    image: null,
    current_price: 0.00001234,
    market_cap: null,
    market_cap_rank: null,
    total_volume: 12_000,
    high_24h: null,
    low_24h: null,
    circulating_supply: null,
    price_change_percentage_24h: 9.9,
    price_change_percentage_1h_in_currency: null,
    price_change_percentage_24h_in_currency: null,
    price_change_percentage_7d_in_currency: null,
    sparkline_in_7d: null,
  },
];

/** Modeled on a real /search/trending response (trimmed; the real one has ~60 currency keys). */
export const trendingFixture = {
  coins: [
    {
      item: {
        id: "orca",
        coin_id: 17547,
        name: "Orca",
        symbol: "ORCA",
        market_cap_rank: 194,
        small:
          "https://coin-images.coingecko.com/coins/images/17547/small/Orca_Logo.png?1696517083",
        slug: "orca",
        score: 0,
        data: {
          price: 3.126092483655871,
          price_change_percentage_24h: { usd: 32.96529747955997, eur: 32.5 },
          market_cap: "$190,728,107",
          sparkline: "https://data.coingecko.com/coins/17547/sparkline.svg",
        },
      },
    },
    {
      // Unranked coin whose price arrives as a display string (older API behaviour).
      item: {
        id: "mystery",
        name: "Mystery",
        symbol: "mys",
        market_cap_rank: null,
        small: null,
        data: { price: "$0.000012", price_change_percentage_24h: null },
      },
    },
    { item: { id: "bare", name: "Bare", symbol: "bre", market_cap_rank: 5 } },
  ],
  nfts: [],
  categories: [],
};

/** A fully-populated coin in the app's own (post-zod) shape; override what matters per test. */
export function makeCoin(overrides: Partial<MarketCoin> & { id: string }): MarketCoin {
  return {
    symbol: overrides.id.toUpperCase(),
    name: overrides.id[0]!.toUpperCase() + overrides.id.slice(1),
    image: null,
    price: 100,
    marketCap: 1_000_000,
    rank: 1,
    volume24h: 1_000,
    high24h: null,
    low24h: null,
    circulatingSupply: null,
    change1h: null,
    change24h: 1,
    change7d: null,
    sparkline: [1, 2, 3, 4],
    ...overrides,
  };
}

/** Modeled on a real /coins/bitcoin response (trimmed to the fields we read, plus noise we must ignore). */
export const coinFixture = {
  id: "bitcoin",
  symbol: "btc",
  name: "Bitcoin",
  web_slug: "bitcoin",
  hashing_algorithm: "SHA-256",
  categories: ["Smart Contract Platform", "Layer 1 (L1)", null, "Proof of Work (PoW)"],
  description: {
    en: 'Bitcoin is the first <a href="https://example.com/p">decentralized</a> cryptocurrency.<br>It runs on a <b>peer-to-peer</b> network.\r\n\r\nSecond paragraph &amp; more &lt;3.<script>alert(1)</script>',
  },
  links: {
    homepage: ["", "http://www.bitcoin.org", "javascript:alert(1)"],
    whitepaper: "https://bitcoin.org/bitcoin.pdf",
    blockchain_site: [
      "https://mempool.space/",
      "",
      "javascript:alert(1)",
      "https://btc.com/",
      "https://mempool.space/",
      "https://explorer3.example/",
      "https://explorer4.example/",
    ],
    official_forum_url: ["https://bitcointalk.org/", "", ""],
    twitter_screen_name: "bitcoin",
    subreddit_url: "https://www.reddit.com/r/Bitcoin/",
    repos_url: { github: ["https://github.com/bitcoin/bitcoin"], bitbucket: [] },
  },
  image: {
    thumb: "t.png",
    small: "s.png",
    large: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
  },
  genesis_date: "2009-01-03",
  market_cap_rank: 1,
  market_data: {
    current_price: { usd: 83753, eur: 77000 },
    market_cap: { usd: 1_682_902_943_476 },
    fully_diluted_valuation: { usd: 1_682_905_539_684 },
    total_volume: { usd: 35_795_803_007 },
    high_24h: { usd: 86648 },
    low_24h: { usd: 83610 },
    price_change_percentage_24h: -2.7723,
    price_change_percentage_7d: -0.15164,
    price_change_percentage_30d: 5.54413,
    price_change_percentage_1y: -32.62003,
    ath: { usd: 126080 },
    ath_date: { usd: "2025-10-06T10:57:42.000Z" },
    ath_change_percentage: { usd: -33.57111 },
    atl: { usd: 67.81 },
    atl_date: { usd: "2013-07-05T16:00:00.000Z" },
    atl_change_percentage: { usd: 123413.7976 },
    circulating_supply: 20_094_687,
    total_supply: 20_094_753,
    max_supply: 21_000_000,
    last_updated: "2026-10-07T11:05:50.000Z",
  },
  last_updated: "2026-10-07T11:05:50.000Z",
};

export const priceChartFixture = {
  prices: [
    [1_791_285_300_000, 86082.85],
    [1_791_285_000_000, 86000],
    [1_791_285_000_500, 86001], // same second as the one above
    [1_791_285_600_000, null],
    [1_791_285_900_000, 86100.1],
  ],
  market_caps: [[1_791_285_000_000, 1]],
  total_volumes: [[1_791_285_000_000, 1]],
};

export const ohlcFixture = [
  [1_791_286_200_000, 86135, 86339, 86067, 86190],
  [1_791_284_400_000, 86000, 86200, 85900, 86135],
  [1_791_288_000_000, 86190, null, 86100, 86250], // incomplete: dropped
  [1_791_287_999_999, 86190, 86300, 86100, 86250],
];
