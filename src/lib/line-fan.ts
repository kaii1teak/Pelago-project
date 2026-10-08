/**
 * Geometry for the decorative line motif: thin lines sweep in from both edges and
 * meet in ONE point, arriving level with it so the bundle pinches smoothly.
 *
 * The lines that rise toward the upper corners are not a separate shape: they are
 * the SAME family of curves, simply carried further up (their far end starts higher
 * and higher off the top of the screen). So they flow out of the existing lines with
 * no seam, in the same ink and weight, and keep the same spacing.
 *
 * Everything is computed in a 1000 x 1000 box that the SVG stretches over whatever
 * element it fills, so the shape adapts to any aspect ratio. The output is static
 * data: no animation, no randomness, so it renders identically on the server and
 * the client.
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
  /**
   * Height above the point, in box units, of the screen's top edge (where whatever
   * crops the box cuts it). The rising lines are spread so they cross it evenly.
   */
  riseTop: number;
  /**
   * How far along that top edge, from each corner, the rising lines reach. The
   * middle stays clear. 0 draws no rising lines.
   */
  riseSpan: number;
  /** Opacity of the brightest rising line. The ends fade to the side lines' faintest. */
  riseOpacity: number;
};

export const CENTER_X = 500;

/** The faintest line of any bundle; the rising lines start from (and end at) this. */
const FAINT = 0.035;

/** Home hero: the meeting point sits below the buttons, in a tall box the hero crops. */
export const HERO_FAN: FanOptions = {
  pointY: 800,
  reach: 235,
  sides: "both",
  sideLines: 20,
  sideBow: 230,
  sideOpacity: 0.42,
  riseTop: 470,
  riseSpan: 330,
  riseOpacity: 0.3,
};

/** Footer banner: the same motif cut at the horizon, which is the footer's top edge. */
export const FOOTER_FAN: FanOptions = {
  pointY: 1000,
  reach: 10000,
  sides: "above",
  sideLines: 40,
  sideBow: 260,
  sideOpacity: 0.4,
  // The banner is already full of side lines: nothing needs carrying higher.
  riseTop: 1000,
  riseSpan: 0,
  riseOpacity: 0,
};

/** Compact numbers keep the markup small: 1 decimal, no trailing ".0". */
const n = (value: number) => String(Math.round(value * 10) / 10);
const opacity = (value: number) => Math.round(value * 100) / 100;

/** One line of the family: from the edge at `startY`, levelling out into the point. */
function lineFrom(
  direction: -1 | 1,
  startY: number,
  o: Pick<FanOptions, "pointY" | "sideBow">,
) {
  const edgeX = direction === -1 ? 0 : 1000;
  const levelX = direction === -1 ? o.sideBow : 1000 - o.sideBow;
  // The control point sits on the point's own height, so every line arrives
  // horizontally and the bundle pinches into the point instead of ending in a bar.
  return `M${n(edgeX)} ${n(startY)}Q${n(levelX)} ${n(o.pointY)} ${CENTER_X} ${n(o.pointY)}`;
}

/**
 * A curve of the family is B(t) = (x(t), point - (1 - t)^2 * K): K is how far above
 * the point it starts. This finds the t at which such a curve is `edgeX` in from the
 * corner, i.e. where it crosses the top edge. x(t) rises from 0 as t does, so
 * bisection is enough.
 */
function crossingParameter(edgeX: number, bow: number) {
  const x = (t: number) => 2 * bow * t * (1 - t) + CENTER_X * t * t;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (x(mid) < edgeX) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

export function buildLineFan(options: FanOptions): {
  sides: FanLine[];
  rising: FanLine[];
} {
  const o = options;
  const sides: FanLine[] = [];
  const rising: FanLine[] = [];

  for (const direction of [-1, 1] as const) {
    for (let i = 0; i < o.sideLines; i++) {
      // -1 .. 1 across the bundle; the middle lines are the brightest.
      const k = o.sideLines === 1 ? 0 : (i / (o.sideLines - 1)) * 2 - 1;
      if (o.sides === "above" && k > 0) continue;
      sides.push({
        d: lineFrom(direction, o.pointY + k * o.reach, o),
        opacity: opacity(
          FAINT + (o.sideOpacity - FAINT) * Math.pow(1 - Math.abs(k), 2.6),
        ),
      });
    }
  }

  if (o.riseSpan > 0 && o.sideLines > 1 && o.riseTop > o.reach) {
    // The same step between neighbours as the side lines have at the edge, so the
    // spacing does not change where the bundles join: first up the edge itself,
    // to the corner, then inward along the top edge.
    const step = (2 * o.reach) / (o.sideLines - 1);
    const alongEdge = o.riseTop - o.reach;
    const total = alongEdge + o.riseSpan;
    const count = Math.floor(total / step);

    for (const direction of [-1, 1] as const) {
      for (let j = 1; j <= count; j++) {
        const distance = j * step;
        let startY: number;
        if (distance <= alongEdge) {
          startY = o.pointY - o.reach - distance;
        } else {
          // Crosses the top edge `distance - alongEdge` in from the corner; a curve
          // that is at riseTop above the point at parameter t started at riseTop / (1 - t)^2.
          const t = crossingParameter(distance - alongEdge, o.sideBow);
          startY = o.pointY - o.riseTop / Math.pow(1 - t, 2);
        }
        // Fades in from, and back out to, the faintest side line: no visible seam.
        const along = distance / total;
        rising.push({
          d: lineFrom(direction, startY, o),
          opacity: opacity(
            FAINT + (o.riseOpacity - FAINT) * Math.pow(Math.sin(Math.PI * along), 1.5),
          ),
        });
      }
    }
  }

  return { sides, rising };
}
