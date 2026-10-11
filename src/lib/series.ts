/**
 * Reduce a numeric series to at most `target` points by averaging equal-width
 * buckets. Keeps the overall shape while cutting payload size (a 7-day hourly
 * sparkline is 168 points; a table cell only needs ~40).
 */
export function downsample(values: readonly number[], target: number): number[] {
  if (target <= 0) return [];
  if (values.length <= target) return [...values];

  const out: number[] = [];
  const size = values.length / target;
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * size);
    const end = Math.max(start + 1, Math.floor((i + 1) * size));
    let sum = 0;
    for (let j = start; j < end; j++) sum += values[j]!;
    out.push(sum / (end - start));
  }
  return out;
}

/**
 * Rounds every value to `digits` significant digits. A sparkline is a hundred pixels wide:
 * the thirteen digits an exchange price arrives with are invisible there, but with a hundred
 * rows of them they were a third of the home page's HTML and of every refresh of the list.
 * Significant digits, not decimals, so a price of $0.00001234 keeps its shape as well as
 * a price of $83,000 does.
 */
export function roundSignificant(values: readonly number[], digits = 6): number[] {
  return values.map((value) =>
    Number.isFinite(value) ? Number(value.toPrecision(digits)) : value,
  );
}

export type SparklinePath = {
  /** SVG path for the line. */
  line: string;
  /** Closed path under the line, for a gradient fill. */
  area: string;
  up: boolean;
};

/**
 * Turn a series into SVG path data inside a `width` x `height` box (y flipped so
 * higher values draw higher). Non-finite points are dropped. Returns null when
 * there's nothing drawable (fewer than 2 points).
 */
export function buildSparklinePath(
  values: readonly number[],
  {
    width = 100,
    height = 32,
    pad = 2,
  }: { width?: number; height?: number; pad?: number } = {},
): SparklinePath | null {
  const points = values.filter((v) => Number.isFinite(v));
  if (points.length < 2) return null;

  let min = Infinity;
  let max = -Infinity;
  for (const v of points) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  const inner = height - pad * 2;
  const step = width / (points.length - 1);

  const coords = points.map((v, i) => {
    // A perfectly flat series draws as a centered horizontal line, not a divide-by-zero.
    const y = range === 0 ? height / 2 : pad + (1 - (v - min) / range) * inner;
    return `${(i * step).toFixed(2)} ${y.toFixed(2)}`;
  });

  const line = `M${coords.join(" L")}`;
  return {
    line,
    area: `${line} L${width} ${height} L0 ${height} Z`,
    up: points[points.length - 1]! >= points[0]!,
  };
}
