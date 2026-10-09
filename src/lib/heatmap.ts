import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import type { HeatCoin } from "@/lib/api/schemas";
import { formatCompactUsd, formatPercent, formatUsd } from "@/lib/format";

/**
 * The market heatmap, as pure functions: which number colors a cell, where each cell sits,
 * what its label says and which cell an arrow key moves to. The components only draw it.
 */

/* ---- choices -------------------------------------------------------------- */

export const HEAT_PERIODS = ["1h", "24h", "7d"] as const;
export type HeatPeriod = (typeof HEAT_PERIODS)[number];

export const HEAT_SIZES = ["cap", "volume"] as const;
export type HeatSize = (typeof HEAT_SIZES)[number];

export const HEAT_UNIVERSES = [50, 100, 200] as const;
export type HeatUniverse = (typeof HEAT_UNIVERSES)[number];

export const PERIOD_LABEL: Record<HeatPeriod, string> = {
  "1h": "1H",
  "24h": "24H",
  "7d": "7D",
};
export const PERIOD_WORDS: Record<HeatPeriod, string> = {
  "1h": "1 hour",
  "24h": "24 hours",
  "7d": "7 days",
};
export const SIZE_LABEL: Record<HeatSize, string> = {
  cap: "Market cap",
  volume: "24h volume",
};

/** The fields a cell needs. Markets rows have them all, so the home preview feeds them straight in. */
export type { HeatCoin };

export function changeFor(coin: HeatCoin, period: HeatPeriod): number | null {
  const value =
    period === "1h" ? coin.change1h : period === "7d" ? coin.change7d : coin.change24h;
  return value != null && Number.isFinite(value) ? value : null;
}

export function sizeOf(coin: HeatCoin, size: HeatSize): number {
  const value = size === "volume" ? coin.volume24h : coin.marketCap;
  return value != null && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * How tall the picture is on a phone, as a multiple of its width: more assets need more
 * room to stay readable. (On a wide screen the height is fixed by the width alone.)
 */
export function tallFor(universe: number): number {
  return universe <= 50 ? 2 : universe <= 100 ? 2.8 : 3.8;
}

/* ---- color ---------------------------------------------------------------- */

/** -3 .. -1 falling (strong .. weak), 0 flat, 1 .. 3 rising. */
export type HeatStep = -3 | -2 | -1 | 0 | 1 | 2 | 3;

/**
 * Where each color step starts, as a percentage move over the period. A move that is
 * big for an hour is nothing for a week, so each period has its own: the same three
 * thresholds (weak, medium, strong) mean "a notable move" in each.
 */
export const HEAT_BREAKS: Record<HeatPeriod, readonly [number, number, number]> = {
  "1h": [0.25, 0.75, 1.5],
  "24h": [1, 3, 6],
  "7d": [3, 8, 15],
};

/** The color step of a change, or null with no number (an unknown is not "flat"). */
export function heatStep(change: number | null, period: HeatPeriod): HeatStep | null {
  if (change == null || !Number.isFinite(change)) return null;
  const [weak, medium, strong] = HEAT_BREAKS[period];
  const size = Math.abs(change);
  const level = size >= strong ? 3 : size >= medium ? 2 : size >= weak ? 1 : 0;
  return (change < 0 ? -level : level) as HeatStep;
}

/** The CSS variable of a step's fill (defined per theme in globals.css). */
export function heatFill(step: HeatStep | null): string {
  if (step === null) return "var(--heat-none)";
  if (step === 0) return "var(--heat-flat)";
  return step > 0 ? `var(--heat-up-${step})` : `var(--heat-down-${-step})`;
}

/** A step in words, for screen readers and the legend ("up more than 3%"). */
export function stepWords(step: HeatStep, period: HeatPeriod): string {
  const [weak, medium, strong] = HEAT_BREAKS[period];
  const edge = (n: number) => `${n}%`;
  if (step === 0) return `within ${edge(weak)} either way`;
  const level = Math.abs(step);
  const from = level === 1 ? weak : level === 2 ? medium : strong;
  const to = level === 1 ? medium : level === 2 ? strong : null;
  const dir = step > 0 ? "up" : "down";
  return to === null
    ? `${dir} more than ${edge(from)}`
    : `${dir} ${edge(from)} to ${edge(to)}`;
}

/* ---- layout --------------------------------------------------------------- */

export type Tile = {
  coin: HeatCoin;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TreemapLayout = {
  /**
   * In the order the coins came in (rank), not by size. A cell keeps its place among the
   * others when the numbers change, so it can slide to its new spot: React would otherwise
   * move its element, and a moved element does not animate. It is also the order screen
   * readers and the Tab key meet the cells in, and it stays the same whatever the area means.
   */
  tiles: Tile[];
  /** Coins in the universe that could not be drawn: no size to go by, or too small to see. */
  skipped: number;
};

/**
 * Lays the first `universe` coins (by market cap) out as a squarified treemap in a
 * `width` x `height` box. Area is proportional to the size metric; a coin without one
 * can't be drawn and is counted in `skipped`. Positions are whole pixels so edges stay
 * crisp and the 1px gap between cells is exact.
 */
export function buildTreemap(
  coins: readonly HeatCoin[],
  {
    width,
    height,
    size,
    universe,
  }: { width: number; height: number; size: HeatSize; universe: number },
): TreemapLayout {
  const slice = coins.slice(0, universe);
  const sized = slice.filter((coin) => sizeOf(coin, size) > 0);
  const skipped = slice.length - sized.length;
  if (!sized.length || !(width > 0) || !(height > 0)) return { tiles: [], skipped };

  const root = hierarchy<Datum>({ children: sized.map((coin) => ({ coin })) })
    .sum((node) => (node.coin ? sizeOf(node.coin, size) : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const laid = treemap<Datum>().tile(treemapSquarify).size([width, height]).round(true)(
    root,
  );

  const all = laid.leaves().map((leaf) => ({
    coin: leaf.data.coin as HeatCoin,
    x: leaf.x0,
    y: leaf.y0,
    w: leaf.x1 - leaf.x0,
    h: leaf.y1 - leaf.y0,
  }));
  // A coin so small it rounds to nothing is no cell: there is nothing to see or to hit.
  const place = new Map(sized.map((coin, index) => [coin.id, index]));
  const tiles = all
    .filter((tile) => tile.w >= 1 && tile.h >= 1)
    .sort((a, b) => place.get(a.coin.id)! - place.get(b.coin.id)!);
  return { tiles, skipped: skipped + all.length - tiles.length };
}

type Datum = { coin?: HeatCoin; children?: Datum[] };

/* ---- labels --------------------------------------------------------------- */

/** Roboto Mono: every glyph is 0.6 em wide, which is what lets labels be fitted without measuring. */
const GLYPH = 0.6;
const LINE = 1.25;
/** Space kept between a label and the edge of its cell. */
export const LABEL_PAD = 6;
const SECONDARY = 0.9;
/** Roboto Mono's capital letters and digits stand 0.71 em tall. */
const CAP_HEIGHT = 0.71;

export type LabelLine = "ticker" | "change" | "price";

export type LabelPlan = {
  lines: LabelLine[];
  /** Ticker size in px; the other lines are SECONDARY times it. */
  fontSize: number;
  /** Baseline of each line, in px from the cell's top edge. */
  baselines: number[];
};

const LAYOUTS: LabelLine[][] = [
  ["ticker", "change", "price"],
  ["ticker", "change"],
  ["ticker"],
];
const SMALLEST = 11;
const SMALLEST_SINGLE = 10;

/**
 * What a cell of this size can say. Each line is optional, in order of importance: the
 * ticker, then the change, then the price. The largest text that fits is used (up to a
 * size that grows with the cell); a cell too small for even its ticker says nothing and
 * is read out through its tooltip and its accessible name instead.
 */
export function planLabel(
  w: number,
  h: number,
  text: { ticker: string; change: string; price: string },
): LabelPlan | null {
  const room = { w: w - 2 * LABEL_PAD, h: h - 2 * LABEL_PAD };
  if (room.w <= 0 || room.h <= 0) return null;
  const biggest = Math.min(30, 11 + Math.sqrt(w * h) / 30);

  for (const lines of LAYOUTS) {
    const scale = (line: LabelLine) => (line === "ticker" ? 1 : SECONDARY);
    const widthEm = Math.max(
      ...lines.map((line) => text[line].length * GLYPH * scale(line)),
    );
    const heightEm = lines.reduce((sum, line) => sum + LINE * scale(line), 0);
    const fontSize = Math.floor(Math.min(biggest, room.w / widthEm, room.h / heightEm));
    const smallest = lines.length === 1 ? SMALLEST_SINGLE : SMALLEST;
    if (fontSize < smallest) continue;

    let top = LABEL_PAD;
    const baselines = lines.map((line) => {
      const size = fontSize * scale(line);
      // Text centred in its line box: the baseline is half a line plus half a cap height down.
      const baseline = top + size * (LINE / 2 + CAP_HEIGHT / 2);
      top += LINE * size;
      return Math.round(baseline);
    });
    return { lines, fontSize, baselines };
  }
  return null;
}

export const secondarySize = (fontSize: number) =>
  Math.round(fontSize * SECONDARY * 10) / 10;

/* ---- keyboard ------------------------------------------------------------- */

export type Direction = "left" | "right" | "up" | "down";

/**
 * The cell an arrow key moves to: the nearest one whose centre lies that way, with
 * sideways drift counted double so "down" prefers the cell below over one far off to the
 * side. Null when nothing lies in that direction (the key then does nothing).
 */
export function neighborOf(
  tiles: readonly Tile[],
  fromId: string,
  direction: Direction,
): string | null {
  const from = tiles.find((t) => t.coin.id === fromId);
  if (!from) return null;
  const cx = from.x + from.w / 2;
  const cy = from.y + from.h / 2;
  let best: { id: string; score: number } | null = null;

  for (const tile of tiles) {
    if (tile === from) continue;
    const dx = tile.x + tile.w / 2 - cx;
    const dy = tile.y + tile.h / 2 - cy;
    const along =
      direction === "left"
        ? -dx
        : direction === "right"
          ? dx
          : direction === "up"
            ? -dy
            : dy;
    const across =
      direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    // Strictly ahead of the current cell's own edge, not merely of its centre.
    const edge =
      direction === "left"
        ? from.x - (tile.x + tile.w)
        : direction === "right"
          ? tile.x - (from.x + from.w)
          : direction === "up"
            ? from.y - (tile.y + tile.h)
            : tile.y - (from.y + from.h);
    if (along <= 0 || edge < -1) continue;
    const score = along + 2 * across;
    if (!best || score < best.score) best = { id: tile.coin.id, score };
  }
  return best?.id ?? null;
}

/* ---- words ---------------------------------------------------------------- */

/** The accessible name of a cell: everything the tooltip says, in a sentence. */
export function cellName(
  coin: HeatCoin,
  period: HeatPeriod,
  price: number | null,
  change: number | null,
): string {
  const parts = [
    `${coin.name} (${coin.symbol})`,
    coin.rank != null ? `rank ${coin.rank}` : null,
    price != null ? formatUsd(price) : null,
    change != null
      ? `${formatPercent(change)} over ${PERIOD_WORDS[period]}`
      : `no ${PERIOD_WORDS[period]} change`,
    coin.marketCap != null ? `market cap ${formatCompactUsd(coin.marketCap)}` : null,
  ];
  return parts.filter(Boolean).join(", ");
}

/* ---- tooltip -------------------------------------------------------------- */

/**
 * Where a tooltip goes: just below and to the right of `anchor`, flipped to the other side
 * of it when it would run out of the frame, and held inside the frame regardless (a tooltip
 * wider than the frame sits at its left edge). All in the frame's own pixels.
 */
export function placeTip(
  anchor: { x: number; y: number },
  tip: { w: number; h: number },
  frame: { w: number; h: number },
  gap = 14,
): { left: number; top: number } {
  let left = anchor.x + gap;
  let top = anchor.y + gap;
  if (left + tip.w > frame.w) left = anchor.x - gap - tip.w;
  if (top + tip.h > frame.h) top = anchor.y - gap - tip.h;
  return {
    left: Math.max(0, Math.min(left, frame.w - tip.w)),
    top: Math.max(0, Math.min(top, frame.h - tip.h)),
  };
}
