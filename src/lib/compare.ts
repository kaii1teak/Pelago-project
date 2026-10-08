import { COIN_ID_PATTERN } from "@/lib/chart";
import type { LinePoint } from "@/lib/chart-data";

export const MAX_COMPARE = 4;
export const MIN_COMPARE = 2;

/**
 * The colors a comparison line can have: the ten chart tokens, each already
 * darkened where needed to read as a thin line on the light page (and left as
 * designed on the dark one). They are token names, not values, so they follow the
 * theme: HTML swatches use them as `var(token)`, the chart canvas resolves them
 * (see readSeriesColors). A color is an index into this list.
 */
export const COMPARE_PALETTE = [
  { token: "--chart-1-line", name: "Violet" },
  { token: "--chart-2-line", name: "Pink" },
  { token: "--chart-3-line", name: "Coral" },
  { token: "--chart-4-line", name: "Orange" },
  { token: "--chart-5-line", name: "Yellow" },
  { token: "--chart-6-line", name: "Magenta" },
  { token: "--chart-7-line", name: "Amber" },
  { token: "--chart-8-line", name: "Cyan" },
  { token: "--chart-9-line", name: "Blue" },
  { token: "--chart-10-line", name: "Green" },
] as const;

export const COMPARE_COLOR_TOKENS = COMPARE_PALETTE.map((c) => c.token);

/**
 * Which colors new assets get, in order: four clearly different hues first (violet,
 * cyan, orange, yellow), then the rest. A new asset takes the first one nobody is using.
 */
const DEFAULT_COLOR_ORDER = [0, 7, 3, 4, 8, 9, 1, 2, 5, 6] as const;

const isColorIndex = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < COMPARE_PALETTE.length;

/**
 * A color for every id. Colors already chosen are kept (that is what keeps a line's
 * color the same while others come and go); anyone without one gets the first
 * default nobody has; and no two assets ever share a color.
 */
export function assignColors(
  ids: readonly string[],
  existing: Readonly<Record<string, number>> = {},
): Record<string, number> {
  const out: Record<string, number> = {};
  const taken = new Set<number>();
  for (const id of ids) {
    const color = existing[id];
    if (isColorIndex(color) && !taken.has(color)) {
      out[id] = color;
      taken.add(color);
    }
  }
  for (const id of ids) {
    if (id in out) continue;
    const free = DEFAULT_COLOR_ORDER.find((c) => !taken.has(c)) ?? 0;
    out[id] = free;
    taken.add(free);
  }
  return out;
}

/**
 * Gives `id` the color `color`. If another asset already has it, the two swap, so a
 * pick always does what it says and no two lines ever look alike.
 */
export function withColor(
  colors: Readonly<Record<string, number>>,
  id: string,
  color: number,
): Record<string, number> {
  if (!isColorIndex(color) || !(id in colors)) return { ...colors };
  const holder = Object.keys(colors).find(
    (other) => other !== id && colors[other] === color,
  );
  const out = { ...colors, [id]: color };
  if (holder) out[holder] = colors[id]!;
  return out;
}

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
 *
 * `series` holds percent change from that start; `raw` the same stretch as prices,
 * for showing real dollar values instead.
 */
export function alignPercentSeries(seriesList: readonly (readonly LinePoint[])[]) {
  const firsts = seriesList.flatMap((s) => (s.length ? [s[0]!.time] : []));
  const start = firsts.length ? Math.max(...firsts) : null;
  const raw = seriesList.map((s) =>
    start === null ? [] : s.filter((p) => p.time >= start),
  );
  return { start, series: raw.map((points) => toPercentSeries(points)), raw };
}

/** What the comparison chart plots: percent change from a shared start, or the prices themselves. */
export type CompareView = "change" | "price";
export const COMPARE_VIEWS = ["change", "price"] as const;
export const isCompareView = (value: unknown): value is CompareView =>
  typeof value === "string" && (COMPARE_VIEWS as readonly string[]).includes(value);

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
