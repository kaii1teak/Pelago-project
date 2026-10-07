import { describe, expect, it } from "vitest";
import { CENTER_X, FOOTER_FAN, HERO_FAN, buildLineFan } from "./line-fan";

/** Every number in a path, as [x, y] pairs in drawing order. */
const points = (d: string) => {
  const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i < nums.length; i += 2) out.push([nums[i]!, nums[i + 1]!]);
  return out;
};
const startY = (d: string) => points(d)[0]![1];

describe("buildLineFan", () => {
  it("is static data: the same input always gives the same lines", () => {
    expect(buildLineFan(HERO_FAN)).toEqual(buildLineFan(HERO_FAN));
  });

  it("draws the configured side lines on both sides, plus rising lines", () => {
    const { sides, rising } = buildLineFan(HERO_FAN);
    expect(sides).toHaveLength(HERO_FAN.sideLines * 2);
    expect(rising.length).toBeGreaterThan(0);
    expect(rising.length % 2).toBe(0);
  });

  it("joins every line, rising ones included, in ONE point", () => {
    const { sides, rising } = buildLineFan(HERO_FAN);
    for (const line of [...sides, ...rising]) {
      expect(points(line.d).at(-1)).toEqual([CENTER_X, HERO_FAN.pointY]);
    }
  });

  it("levels every line out on the point's height, so they all pinch smoothly", () => {
    // M start, Q control end: the control point's y is the point's y.
    const { sides, rising } = buildLineFan(HERO_FAN);
    for (const line of [...sides, ...rising]) {
      expect(points(line.d)[1]![1]).toBe(HERO_FAN.pointY);
    }
  });

  it("makes the rising lines the same curve as the side lines (same control point)", () => {
    const { sides, rising } = buildLineFan(HERO_FAN);
    const control = (d: string) => points(d)[1]!;
    for (const line of rising) {
      expect(sides.map((s) => control(s.d))).toContainEqual(control(line.d));
    }
  });

  it("has no central fan: every rising line starts at an edge and none rises straight up", () => {
    for (const line of buildLineFan(HERO_FAN).rising) {
      const [from] = points(line.d);
      expect([0, 1000]).toContain(from![0]);
    }
  });

  it("continues upward from the highest side line, never overlapping it", () => {
    const { sides, rising } = buildLineFan(HERO_FAN);
    const left = (lines: typeof sides) => lines.filter((l) => points(l.d)[0]![0] === 0);
    const highestSide = Math.min(...left(sides).map((l) => startY(l.d)));
    // Every rising line on the left starts above it (a smaller y)...
    const edgeStarts = left(rising).map((l) => startY(l.d));
    expect(Math.max(...edgeStarts)).toBeLessThan(highestSide);
    // ...and the rising lines are ordered going up, with no repeats.
    const sorted = [...edgeStarts].sort((a, b) => b - a);
    expect(new Set(edgeStarts).size).toBe(edgeStarts.length);
    expect(sorted[0]).toBeLessThan(highestSide);
  });

  it("keeps the same spacing where the bundles join and along the screen edge", () => {
    const { sides, rising } = buildLineFan(HERO_FAN);
    const leftStarts = (lines: typeof sides) =>
      lines.filter((l) => points(l.d)[0]![0] === 0).map((l) => startY(l.d));
    const step = (2 * HERO_FAN.reach) / (HERO_FAN.sideLines - 1);

    // Existing lines: equal steps (they are generated from a linear k).
    const sideYs = leftStarts(sides).sort((a, b) => b - a);
    for (let i = 1; i < sideYs.length; i++) {
      expect(sideYs[i - 1]! - sideYs[i]!).toBeCloseTo(step, 0);
    }
    // The first rising line is exactly one step above the highest existing one...
    const risingYs = leftStarts(rising).sort((a, b) => b - a);
    const topSide = Math.min(...sideYs);
    expect(topSide - risingYs[0]!).toBeCloseTo(step, 0);
    // ...and as long as they start on the edge, the steps stay the same.
    const edgeLimit = HERO_FAN.pointY - HERO_FAN.riseTop;
    const onEdge = risingYs.filter((y) => y >= edgeLimit);
    for (let i = 1; i < onEdge.length; i++) {
      expect(onEdge[i - 1]! - onEdge[i]!).toBeCloseTo(step, 0);
    }
  });

  it("spreads the lines that cross the top edge evenly, within the span", () => {
    // The curve is B(t): find where each rising line is at the top edge's height.
    const { rising } = buildLineFan(HERO_FAN);
    const crossings: number[] = [];
    for (const line of rising) {
      const [from, control] = points(line.d);
      if (from![0] !== 0) continue; // left side
      const y0 = from![1];
      const targetRise = HERO_FAN.riseTop;
      const rise0 = HERO_FAN.pointY - y0;
      if (rise0 < targetRise) continue; // starts on the edge, below the top
      // (1 - t)^2 * rise0 = riseTop
      const t = 1 - Math.sqrt(targetRise / rise0);
      const x = 2 * control![0] * t * (1 - t) + CENTER_X * t * t;
      crossings.push(x);
    }
    crossings.sort((a, b) => a - b);
    expect(crossings.length).toBeGreaterThan(5);
    expect(crossings[0]!).toBeGreaterThanOrEqual(0);
    expect(crossings.at(-1)!).toBeLessThanOrEqual(HERO_FAN.riseSpan + 1);
    const step = (2 * HERO_FAN.reach) / (HERO_FAN.sideLines - 1);
    for (let i = 1; i < crossings.length; i++) {
      expect(crossings[i]! - crossings[i - 1]!).toBeCloseTo(step, 0);
    }
    // The middle of the top stays clear: nothing crosses closer to the center than the span.
    expect(HERO_FAN.riseSpan).toBeLessThan(CENTER_X);
  });

  it("is exactly symmetric: every line has a mirror image on the other side", () => {
    const { sides, rising } = buildLineFan(HERO_FAN);
    for (const group of [sides, rising]) {
      const half = group.length / 2;
      for (let i = 0; i < half; i++) {
        const left = points(group[i]!.d);
        const right = points(group[half + i]!.d);
        expect(right.map(([x]) => x)).toEqual(left.map(([x]) => 1000 - x));
        expect(right.map(([, y]) => y)).toEqual(left.map(([, y]) => y));
        expect(group[half + i]!.opacity).toBe(group[i]!.opacity);
      }
    }
  });

  it("uses the same ink: rising lines fade in from, and out to, the faintest side line", () => {
    const { sides, rising } = buildLineFan(HERO_FAN);
    const faintest = Math.min(...sides.map((s) => s.opacity));
    const half = rising.length / 2;
    const left = rising.slice(0, half).map((l) => l.opacity);
    // No seam at either end of the rising bundle.
    expect(left[0]!).toBeLessThanOrEqual(faintest + 0.05);
    expect(left.at(-1)!).toBeLessThanOrEqual(faintest + 0.05);
    // Never brighter than the existing brightest line.
    for (const line of rising) {
      expect(line.opacity).toBeLessThanOrEqual(HERO_FAN.sideOpacity);
      expect(line.opacity).toBeGreaterThan(0);
    }
  });

  it("is brightest in the middle of the side bundle, and valid as an opacity everywhere", () => {
    const { sides, rising } = buildLineFan(HERO_FAN);
    for (const line of [...sides, ...rising]) {
      expect(line.opacity).toBeGreaterThan(0);
      expect(line.opacity).toBeLessThanOrEqual(1);
    }
    const middle = sides[Math.floor(HERO_FAN.sideLines / 2)]!.opacity;
    expect(middle).toBeGreaterThan(sides[0]!.opacity * 3);
  });

  it("'above' skips the lines that would start below the horizon", () => {
    const both = buildLineFan({ ...FOOTER_FAN, sides: "both" }).sides;
    const above = buildLineFan(FOOTER_FAN).sides;
    expect(above.length).toBeLessThan(both.length);
    for (const line of above) {
      expect(startY(line.d)).toBeLessThanOrEqual(FOOTER_FAN.pointY);
    }
  });

  it("lets the footer's lines start above its box (they are cropped) but always end at the horizon", () => {
    const { sides, rising } = buildLineFan(FOOTER_FAN);
    expect(rising).toEqual([]);
    for (const line of sides) {
      const [from, control, end] = points(line.d);
      // Starts on a side edge, at or above the horizon; may be far above the box.
      expect([0, 1000]).toContain(from![0]);
      expect(from![1]).toBeLessThanOrEqual(FOOTER_FAN.pointY);
      // The control point and the meeting point stay inside the box.
      for (const [x, y] of [control!, end!]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1000);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1000);
      }
      expect(end).toEqual([CENTER_X, FOOTER_FAN.pointY]);
    }
  });

  it("can draw the side bundles only", () => {
    expect(buildLineFan({ ...HERO_FAN, riseSpan: 0 }).rising).toEqual([]);
  });
});
