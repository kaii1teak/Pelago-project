/**
 * Curated category filters. CoinGecko has ~1,000 categories, far too many for
 * a filter bar, so these are the broad, well-populated ones. Every `id` was
 * checked against /coins/categories/list; a typo here would silently return
 * an empty table, so don't edit ids without re-checking.
 */
export const CATEGORIES = [
  { id: "layer-1", label: "Layer 1" },
  { id: "layer-2", label: "Layer 2" },
  { id: "decentralized-finance-defi", label: "DeFi" },
  { id: "stablecoins", label: "Stablecoins" },
  { id: "meme-token", label: "Meme" },
  { id: "artificial-intelligence", label: "AI" },
  { id: "real-world-assets-rwa", label: "RWA" },
  { id: "gaming", label: "Gaming" },
  { id: "depin", label: "DePIN" },
  { id: "liquid-staking-tokens", label: "Liquid staking" },
  { id: "privacy-coins", label: "Privacy" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

const CATEGORY_IDS: readonly string[] = CATEGORIES.map((c) => c.id);

/**
 * Only curated categories are accepted anywhere a category comes from outside
 * (URLs, API params). A regex would still let a caller invent unlimited valid-
 * looking slugs, and each one would cost an upstream request.
 */
export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && CATEGORY_IDS.includes(value);
}
