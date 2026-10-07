/**
 * Geometry for the decorative line motif: bundles of thin lines sweep in from
 * both edges and meet in ONE point, then (optionally) a fan of rays rises from
 * that point and fades out.
 *
 * Everything is computed in a 1000 x 1000 box that the SVG stretches over
 * whatever element it fills, so the shape adapts to any aspect ratio. The output is
 * static data: no animation, no randomness, so it renders identically on the
 * server and the client.
 */

export type FanLine = {
  /** SVG path data. */
  d: string;
  /** 0..1, applied as stroke-opacity. */
  opacity: number;
};

export type FanOptions = {
  /** Height of the meeting point, 0 (top) to 1000 (bottom). */
  pointY: number;
  /** How far from the point's height the side lines start, at the left/right edges. */
  reach: number;
  /** "above" draws only the lines that start higher than the point (a horizon). */
  sides: "both" | "above";
  sideLines: number;
  /** Distance from the edge at which a side line levels out into the point. */
  sideBow: number;
  /** Opacity of the brightest (middle) side line. */
  sideOpacity: number;
  /** Rising rays. 0 for none. */
  rayLines: number;
  /** Height where the rays end (and have faded out completely). */
  rayTop: number;
  /** Half the width of the fan at its top. */
  raySpread: number;
  /** How far up the control point sits (0..1 of the rise): higher = rays leave straighter. */
  rayPull: number;
  /** Opacity of the brightest (middle) ray. */
  rayOpacity: number;
};

export const CENTER_X = 500;

/** Home hero: meeting point below the buttons, a wide fan rising behind the copy. */
export const HERO_FAN: FanOptions = {
  pointY: 640,
  reach: 400,
  sides: "both",
  sideLines: 36,
  sideBow: 230,
  sideOpacity: 0.42,
  rayLines: 40,
  rayTop: 110,
  raySpread: 380,
  rayPull: 0.55,
  rayOpacity: 0.4,
};

/** Footer banner: the same motif cut at the horizon, which is the footer's top edge. */
export const FOOTER_FAN: FanOptions = {
  pointY: 1000,
  reach: 1000,
  sides: "above",
  sideLines: 26,
  sideBow: 260,
  sideOpacity: 0.4,
  rayLines: 30,
  rayTop: 200,
  raySpread: 300,
  rayPull: 0.5,
  rayOpacity: 0.35,
};

/** Compact numbers keep the markup small: 1 decimal, no trailing ".0". */
const n = (value: number) => String(Math.round(value * 10) / 10);
const opacity = (value: number) => Math.round(value * 100) / 100;

export function buildLineFan(options: FanOptions): { sides: FanLine[]; rays: FanLine[] } {
  const o = options;
  const sides: FanLine[] = [];
  const rays: FanLine[] = [];

  for (const direction of [-1, 1]) {
    const edgeX = direction === -1 ? 0 : 1000;
    const levelX = direction === -1 ? o.sideBow : 1000 - o.sideBow;
    for (let i = 0; i < o.sideLines; i++) {
      // -1 .. 1 across the bundle; the middle lines are the brightest.
      const k = o.sideLines === 1 ? 0 : (i / (o.sideLines - 1)) * 2 - 1;
      if (o.sides === "above" && k > 0) continue;
      const startY = o.pointY + k * o.reach;
      // The control point sits on the point's own height, so every line arrives
      // horizontally and the bundle pinches into the point instead of ending in a bar.
      sides.push({
        d: `M${n(edgeX)} ${n(startY)}Q${n(levelX)} ${n(o.pointY)} ${CENTER_X} ${n(o.pointY)}`,
        opacity: opacity(
          0.035 + (o.sideOpacity - 0.035) * Math.pow(1 - Math.abs(k), 2.6),
        ),
      });
    }
  }

  const rise = o.pointY - o.rayTop;
  for (let j = 0; j < o.rayLines; j++) {
    const u = o.rayLines === 1 ? 0 : (j / (o.rayLines - 1)) * 2 - 1;
    // Leaves the point straight up (control point above it), then opens out.
    rays.push({
      d: `M${CENTER_X} ${n(o.pointY)}Q${CENTER_X} ${n(o.pointY - rise * o.rayPull)} ${n(CENTER_X + u * o.raySpread)} ${n(o.rayTop)}`,
      opacity: opacity(0.04 + (o.rayOpacity - 0.04) * Math.pow(1 - Math.abs(u), 1.6)),
    });
  }

  return { sides, rays };
}
