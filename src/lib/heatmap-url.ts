import { isCategoryId } from "./categories";
import {
  HEAT_PERIODS,
  HEAT_SIZES,
  HEAT_UNIVERSES,
  type HeatPeriod,
  type HeatSize,
  type HeatUniverse,
} from "./heatmap";

/** Everything about the heatmap that lives in the URL, so a link reproduces the exact picture. */
export type HeatmapState = {
  period: HeatPeriod;
  size: HeatSize;
  /** How many assets; null = the default for the screen (see defaultUniverse). */
  top: HeatUniverse | null;
  /** CoinGecko category id, or null for all assets. */
  category: string | null;
};

export const DEFAULT_STATE: HeatmapState = {
  period: "24h",
  size: "cap",
  top: null,
  category: null,
};

/** A phone has room for fewer cells than a desktop, so it starts with fewer. */
export const defaultUniverse = (narrow: boolean): HeatUniverse => (narrow ? 50 : 100);

const isOneOf = <T extends string>(
  list: readonly T[],
  value: string | null,
): value is T => value !== null && (list as readonly string[]).includes(value);

/** URL -> state. Never throws: a hand-edited or stale link still loads a working page. */
export function parseHeatmapState(params: URLSearchParams): HeatmapState {
  const period = params.get("period");
  const size = params.get("size");
  const top = Number.parseInt(params.get("top") ?? "", 10);
  const category = params.get("category");
  return {
    period: isOneOf(HEAT_PERIODS, period) ? period : DEFAULT_STATE.period,
    size: isOneOf(HEAT_SIZES, size) ? size : DEFAULT_STATE.size,
    top: (HEAT_UNIVERSES as readonly number[]).includes(top)
      ? (top as HeatUniverse)
      : null,
    category: isCategoryId(category) ? category : null,
  };
}

/** State -> query string (no leading "?"). Defaults are left out so the plain page has a plain URL. */
export function heatmapStateToSearch(state: HeatmapState): string {
  const params = new URLSearchParams();
  if (state.period !== DEFAULT_STATE.period) params.set("period", state.period);
  if (state.size !== DEFAULT_STATE.size) params.set("size", state.size);
  if (state.top) params.set("top", String(state.top));
  if (state.category) params.set("category", state.category);
  return params.toString();
}
