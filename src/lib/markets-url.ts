import { isCategoryId } from "./categories";
import {
  DEFAULT_DIR,
  SORT_KEYS,
  VIEWS,
  type MoversView,
  type SortDir,
  type SortKey,
} from "./markets-table";

/** Everything about the Markets view that lives in the URL, so it can be shared and survives reloads. */
export type MarketsState = {
  q: string;
  sort: SortKey;
  dir: SortDir;
  view: MoversView;
  /** CoinGecko category id, or null for all assets. */
  category: string | null;
  page: number;
};

export const DEFAULT_STATE: MarketsState = {
  q: "",
  sort: "rank",
  dir: "asc",
  view: "all",
  category: null,
  page: 1,
};

const MAX_QUERY_LENGTH = 60;

const isOneOf = <T extends string>(
  list: readonly T[],
  value: string | null,
): value is T => value !== null && (list as readonly string[]).includes(value);

/**
 * URL -> state. Never throws: anything missing or invalid falls back to the
 * default, because a hand-edited or stale link must still load a working page.
 */
export function parseMarketsState(params: URLSearchParams): MarketsState {
  const sort = params.get("sort");
  const dir = params.get("dir");
  const view = params.get("view");
  const category = params.get("category");
  const page = Number.parseInt(params.get("page") ?? "", 10);

  const resolvedSort = isOneOf(SORT_KEYS, sort) ? sort : DEFAULT_STATE.sort;
  return {
    q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    sort: resolvedSort,
    dir: dir === "asc" || dir === "desc" ? dir : DEFAULT_DIR[resolvedSort],
    view: isOneOf(VIEWS, view) ? view : DEFAULT_STATE.view,
    category: isCategoryId(category) ? category : null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** State -> query string (no leading "?"). Defaults are omitted so the plain page has a plain URL. */
export function marketsStateToSearch(state: MarketsState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.sort !== DEFAULT_STATE.sort) params.set("sort", state.sort);
  // dir only matters when it differs from the column's natural direction.
  if (state.dir !== DEFAULT_DIR[state.sort]) params.set("dir", state.dir);
  if (state.view !== DEFAULT_STATE.view) params.set("view", state.view);
  if (state.category) params.set("category", state.category);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}
