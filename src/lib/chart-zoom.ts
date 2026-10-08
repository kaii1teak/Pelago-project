/**
 * Pure maths for zooming and for noticing that the user has scrolled to the edge
 * of what is loaded. Ranges are in "logical" units: bar indexes, 0 being the first
 * bar of the data, negative meaning scrolled past it.
 */

export type LogicalRange = { from: number; to: number };

/** A zoom step: each press of + / - (or wheel notch) shows this much more or less. */
export const ZOOM_STEP = 0.6;

/**
 * Zooms `range` by `factor` (below 1 zooms in, above 1 zooms out), keeping the
 * point at `anchor` (0 = left edge, 1 = right edge of the view) where it is on screen.
 * The result is never narrower than `minBars` or wider than `maxBars`.
 */
export function zoomLogicalRange(
  range: LogicalRange,
  factor: number,
  anchor = 0.5,
  { minBars = 6, maxBars = Number.POSITIVE_INFINITY } = {},
): LogicalRange {
  const width = range.to - range.from;
  const next = Math.min(maxBars, Math.max(minBars, width * factor));
  const pivot = range.from + width * anchor;
  const from = pivot - next * anchor;
  return { from, to: from + next };
}

/**
 * Whether the view is within reach of the first loaded bar: the left edge is closer
 * than a few bars, or than 40% of what is on screen. That is the moment to fetch
 * older history, a little before the user actually runs out of chart.
 */
export function isNearStart(range: LogicalRange, bars = 5, share = 0.4): boolean {
  return range.from < Math.max(bars, (range.to - range.from) * share);
}
