import { COIN_ID_PATTERN } from "@/lib/chart";
import type { LinePoint } from "@/lib/chart-data";

export const MAX_COMPARE = 4;
export const MIN_COMPARE = 2;

/**
 * The line color of each slot (purple, teal, orange, olive: four clearly
 * different hues, each one already darkened to read on the light theme). They
 * are token names, not values, so they follow the theme: HTML swatches use them as
 * `var(token)`, the chart canvas resolves them (see readSeriesColors).
 */
export const COMPARE_COLOR_TOKENS = [
  "--chart-1-line",
  "--chart-8-line",
  "--chart-4-line",
  "--chart-5-line",
] as const;

/**
 * The assets named in a link (?assets=bitcoin,ethereum). Anything that can't be
 * a coin id is dropped, duplicates collapse, and only the first MAX_COMPARE are
 * kept: the value is user-editable text and ends up in API requests.
 */
export function parseCompareIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const valid = raw.split(",").filter((id) => COIN_ID_PATTERN.test(id));
  return [...new Set(valid)].slice(0, MAX_COMPARE);
}

/** Percent change of every point relative to the first one: the line starts at 0. */
export function toPercentSeries(points: readonly LinePoint[]): LinePoint[] {
  const base = points[0]?.value;
  // A zero or negative base can't be a price, and dividing by it would be nonsense.
  if (base === undefined || !(base > 0)) return [];
  return points.map((p) => ({ time: p.time, value: (p.value / base - 1) * 100 }));
}

/**
 * Puts every series on the same footing: they all start at the latest moment
 * that every asset has data for, and are then measured from there. Without this
 * each line would start at its own first point, so "+12%" on one line and on
 * another would cover different stretches of time. Empty series are ignored when
 * choosing the start and stay empty.
 */
export function alignPercentSeries(seriesList: readonly (readonly LinePoint[])[]) {
  const firsts = seriesList.flatMap((s) => (s.length ? [s[0]!.time] : []));
  const start = firsts.length ? Math.max(...firsts) : null;
  const series = seriesList.map((s) =>
    start === null ? [] : toPercentSeries(s.filter((p) => p.time >= start)),
  );
  return { start, series };
}

/**
 * The asset whose history starts so much later than the others that the shared
 * start had to move up for everyone (a recently listed coin on a long range).
 * `tolerance` is the gap, in seconds, below which that isn't worth mentioning.
 */
export function findLateStarter(
  seriesList: readonly (readonly LinePoint[])[],
  tolerance: number,
): { index: number; start: number } | null {
  const firsts = seriesList.map((s) => s[0]?.time ?? null);
  const known = firsts.filter((t): t is number => t !== null);
  if (known.length < 2) return null;
  const start = Math.max(...known);
  if (start - Math.min(...known) <= tolerance) return null;
  return { index: firsts.indexOf(start), start };
}

/** Percent change over the whole (aligned) series, or null when there's nothing to measure. */
export function totalReturn(percentSeries: readonly LinePoint[]): number | null {
  return percentSeries.length > 1 ? percentSeries[percentSeries.length - 1]!.value : null;
}
