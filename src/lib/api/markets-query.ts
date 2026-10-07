/**
 * Shared (browser + server) description of a /api/markets request. Deliberately
 * dependency-free so importing it from client code doesn't pull in zod.
 */

export const PER_PAGE_OPTIONS = [10, 25, 50, 100, 250] as const;
export const DEFAULT_PER_PAGE = 100;
export const MAX_IDS = 50;

export type MarketsParams = {
  /** Specific coins (watchlist/compare). May include coins outside the top 100. */
  ids?: readonly string[];
  category?: string;
  page?: number;
  perPage?: number;
};

/**
 * Canonical form of a request: ids de-duplicated and sorted, defaults dropped.
 * Two requests for the same data always normalize identically, so they share
 * one TanStack Query entry, one URL, and one upstream cache entry.
 */
export function normalizeMarketsParams(params: MarketsParams = {}): MarketsParams {
  const ids = params.ids?.length ? [...new Set(params.ids)].sort() : undefined;
  return {
    ...(ids && { ids }),
    ...(params.category && { category: params.category }),
    ...(params.page && params.page > 1 && { page: params.page }),
    ...(params.perPage &&
      params.perPage !== DEFAULT_PER_PAGE && { perPage: params.perPage }),
  };
}

export function marketsUrl(params: MarketsParams = {}) {
  const p = normalizeMarketsParams(params);
  const search = new URLSearchParams();
  if (p.ids) search.set("ids", p.ids.join(","));
  if (p.category) search.set("category", p.category);
  if (p.page) search.set("page", String(p.page));
  if (p.perPage) search.set("per_page", String(p.perPage));
  const qs = search.toString();
  return qs ? `/api/markets?${qs}` : "/api/markets";
}
