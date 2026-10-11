import { describe, expect, it } from "vitest";
import { buildSparklinePath, downsample, roundSignificant } from "./series";

describe("roundSignificant", () => {
  it("keeps six significant digits, whatever the size of the number", () => {
    expect(
      roundSignificant([83064.28345722, 0.0000123456789, 1.00013872, 123456789]),
    ).toEqual([83064.3, 0.0000123457, 1.00014, 123457000]);
  });

  it("leaves a series that is already short exactly as it is", () => {
    expect(roundSignificant([1, 2.5, 0])).toEqual([1, 2.5, 0]);
  });

  it("does not turn a missing number into a number", () => {
    const out = roundSignificant([1, Number.NaN, Number.POSITIVE_INFINITY]);
    expect(Number.isNaN(out[1])).toBe(true);
    expect(out[2]).toBe(Number.POSITIVE_INFINITY);
  });

  it("keeps the shape of a flat series, a stablecoin's sparkline, visible", () => {
    const flat = [0.99987, 1.0001, 0.99991, 1.00013, 0.99995];
    const rounded = roundSignificant(flat);
    expect(rounded.indexOf(Math.max(...rounded))).toBe(flat.indexOf(Math.max(...flat)));
    expect(rounded.indexOf(Math.min(...rounded))).toBe(flat.indexOf(Math.min(...flat)));
    expect(new Set(rounded).size).toBe(flat.length);
  });

  it("makes a market list's payload much smaller", () => {
    const raw = Array.from(
      { length: 42 },
      (_, i) => 83000 + Math.sin(i) * 1234.5678912345,
    );
    const before = JSON.stringify(raw).length;
    const after = JSON.stringify(roundSignificant(raw)).length;
    expect(after).toBeLessThan(before * 0.6);
  });
});

describe("downsample", () => {
  it("returns a copy unchanged when already short enough", () => {
    const input = [1, 2, 3];
    const out = downsample(input, 10);
    expect(out).toEqual([1, 2, 3]);
    expect(out).not.toBe(input);
  });

  it("reduces to exactly the target length", () => {
    const input = Array.from({ length: 168 }, (_, i) => i);
    expect(downsample(input, 42)).toHaveLength(42);
  });

  it("averages buckets, preserving the overall trend", () => {
    expect(downsample([1, 3, 5, 7], 2)).toEqual([2, 6]);
  });

  it("keeps a monotonic series monotonic", () => {
    const out = downsample(
      Array.from({ length: 100 }, (_, i) => i * 2),
      13,
    );
    expect(out).toEqual([...out].sort((a, b) => a - b));
  });

  it("handles empty input and non-positive targets", () => {
    expect(downsample([], 5)).toEqual([]);
    expect(downsample([1, 2, 3], 0)).toEqual([]);
  });
});

describe("buildSparklinePath", () => {
  it("spans the box left to right and flips y so higher values draw higher", () => {
    const path = buildSparklinePath([0, 10], { width: 100, height: 32, pad: 2 })!;
    // first point is the minimum -> bottom (y = height - pad); last is max -> top (y = pad)
    expect(path.line).toBe("M0.00 30.00 L100.00 2.00");
    expect(path.up).toBe(true);
  });

  it("closes the area down to the baseline", () => {
    const path = buildSparklinePath([1, 2, 3], { width: 100, height: 32 })!;
    expect(path.area.endsWith("L100 32 L0 32 Z")).toBe(true);
  });

  it("reports direction from first to last point", () => {
    expect(buildSparklinePath([5, 9, 1])!.up).toBe(false);
    expect(buildSparklinePath([1, 9, 5])!.up).toBe(true);
  });

  it("draws a flat series as a centered line instead of dividing by zero", () => {
    const path = buildSparklinePath([7, 7, 7], { width: 100, height: 32 })!;
    expect(path.line).not.toMatch(/NaN|Infinity/);
    expect(path.line).toBe("M0.00 16.00 L50.00 16.00 L100.00 16.00");
  });

  it("drops non-finite points", () => {
    const path = buildSparklinePath([1, Number.NaN, 3, Number.POSITIVE_INFINITY, 5])!;
    expect(path.line).not.toMatch(/NaN|Infinity/);
    expect(path.line.split("L")).toHaveLength(3);
  });

  it("returns null when there's nothing to draw", () => {
    expect(buildSparklinePath([])).toBeNull();
    expect(buildSparklinePath([4])).toBeNull();
    expect(buildSparklinePath([Number.NaN, 2])).toBeNull();
  });
});
