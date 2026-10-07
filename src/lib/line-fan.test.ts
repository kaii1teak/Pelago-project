import { describe, expect, it } from "vitest";
import { CENTER_X, FOOTER_FAN, HERO_FAN, buildLineFan } from "./line-fan";

/** Every number in a path, as [x, y] pairs in drawing order. */
const points = (d: string) => {
  const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i < nums.length; i += 2) out.push([nums[i]!, nums[i + 1]!]);
  return out;
};

describe("buildLineFan", () => {
  it("is static data: the same input always gives the same lines", () => {
    expect(buildLineFan(HERO_FAN)).toEqual(buildLineFan(HERO_FAN));
  });

  it("draws the configured number of lines on both sides, plus the rays", () => {
    const { sides, rays } = buildLineFan(HERO_FAN);
    expect(sides).toHaveLength(HERO_FAN.sideLines * 2);
    expect(rays).toHaveLength(HERO_FAN.rayLines);
  });

  it("joins every line in ONE point (no bar, no gap)", () => {
    const { sides, rays } = buildLineFan(HERO_FAN);
    for (const line of sides) {
      const end = points(line.d).at(-1)!;
      expect(end).toEqual([CENTER_X, HERO_FAN.pointY]);
    }
    for (const line of rays) {
      expect(points(line.d)[0]).toEqual([CENTER_X, HERO_FAN.pointY]);
    }
  });

  it("levels every side line out on the point's height, so they pinch smoothly", () => {
    // M start, Q control end: the control point's y is the point's y.
    for (const line of buildLineFan(HERO_FAN).sides) {
      const [, control] = points(line.d);
      expect(control![1]).toBe(HERO_FAN.pointY);
    }
  });

  it("makes the rays leave the point straight up, then open out", () => {
    for (const line of buildLineFan(HERO_FAN).rays) {
      const [start, control, end] = points(line.d);
      expect(control![0]).toBe(start![0]); // vertical tangent at the point
      expect(control![1]).toBeLessThan(start![1]);
      expect(end![1]).toBe(HERO_FAN.rayTop);
    }
  });

  it("only fills part of the space above: rays stay between the point and rayTop", () => {
    for (const line of buildLineFan(HERO_FAN).rays) {
      for (const [, y] of points(line.d)) {
        expect(y).toBeGreaterThanOrEqual(HERO_FAN.rayTop);
        expect(y).toBeLessThanOrEqual(HERO_FAN.pointY);
      }
    }
    expect(HERO_FAN.rayTop).toBeGreaterThan(0);
  });

  it("keeps everything inside the 1000 x 1000 box where it is meant to be visible", () => {
    const { sides, rays } = buildLineFan(FOOTER_FAN);
    for (const line of [...sides, ...rays]) {
      for (const [x, y] of points(line.d)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1000);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1000);
      }
    }
  });

  it("'above' skips the lines that would start below the horizon", () => {
    const both = buildLineFan({ ...FOOTER_FAN, sides: "both" }).sides;
    const above = buildLineFan(FOOTER_FAN).sides;
    expect(above.length).toBeLessThan(both.length);
    for (const line of above) {
      expect(points(line.d)[0]![1]).toBeLessThanOrEqual(FOOTER_FAN.pointY);
    }
  });

  it("is symmetric: the left and right bundles mirror each other", () => {
    const { sides } = buildLineFan(HERO_FAN);
    const half = sides.length / 2;
    for (let i = 0; i < half; i++) {
      const left = points(sides[i]!.d);
      const right = points(sides[half + i]!.d);
      expect(right[0]![0]).toBe(1000 - left[0]![0]);
      expect(right[0]![1]).toBe(left[0]![1]);
      expect(sides[half + i]!.opacity).toBe(sides[i]!.opacity);
    }
  });

  it("is brightest in the middle and valid as an opacity everywhere", () => {
    const { sides, rays } = buildLineFan(HERO_FAN);
    for (const line of [...sides, ...rays]) {
      expect(line.opacity).toBeGreaterThan(0);
      expect(line.opacity).toBeLessThanOrEqual(1);
    }
    const middle = sides[Math.floor(HERO_FAN.sideLines / 2)]!.opacity;
    expect(middle).toBeGreaterThan(sides[0]!.opacity * 3);
  });

  it("can draw sides only", () => {
    expect(buildLineFan({ ...HERO_FAN, rayLines: 0 }).rays).toEqual([]);
  });
});
