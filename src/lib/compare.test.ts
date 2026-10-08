import { describe, expect, it } from "vitest";
import {
  COMPARE_COLOR_TOKENS,
  COMPARE_PALETTE,
  MAX_COMPARE,
  alignPercentSeries,
  assignColors,
  isCompareView,
  findLateStarter,
  parseCompareIds,
  toPercentSeries,
  totalReturn,
  withColor,
} from "./compare";

const pts = (...pairs: [number, number][]) =>
  pairs.map(([time, value]) => ({ time, value }));

describe("parseCompareIds", () => {
  it("reads a comma separated list", () => {
    expect(parseCompareIds("bitcoin,ethereum")).toEqual(["bitcoin", "ethereum"]);
  });

  it("returns nothing for an empty or missing value", () => {
    expect(parseCompareIds(null)).toEqual([]);
    expect(parseCompareIds(undefined)).toEqual([]);
    expect(parseCompareIds("")).toEqual([]);
  });

  it("drops anything that cannot be a coin id", () => {
    expect(parseCompareIds("bitcoin,../etc,Bad Id,,ethereum,<script>")).toEqual([
      "bitcoin",
      "ethereum",
    ]);
  });

  it("collapses duplicates and keeps the first MAX_COMPARE", () => {
    expect(parseCompareIds("a,b,a,c,d,e,f")).toEqual(["a", "b", "c", "d"]);
    expect(MAX_COMPARE).toBe(4);
  });
});

describe("toPercentSeries", () => {
  it("starts at 0 and measures every point against the first", () => {
    expect(toPercentSeries(pts([1, 100], [2, 150], [3, 50]))).toEqual(
      pts([1, 0], [2, 50], [3, -50]),
    );
  });

  it("keeps times untouched", () => {
    expect(toPercentSeries(pts([10, 5], [20, 5])).map((p) => p.time)).toEqual([10, 20]);
  });

  it("is empty when there is nothing, or no valid base price", () => {
    expect(toPercentSeries([])).toEqual([]);
    expect(toPercentSeries(pts([1, 0], [2, 5]))).toEqual([]);
    expect(toPercentSeries(pts([1, -3], [2, 5]))).toEqual([]);
  });
});

describe("alignPercentSeries", () => {
  it("starts every series at the latest first point, so all lines cover the same time", () => {
    const early = pts([100, 10], [200, 12], [300, 15]);
    const late = pts([200, 40], [300, 44]);
    const { start, series } = alignPercentSeries([early, late]);
    expect(start).toBe(200);
    // The early one is re-based on its value at the shared start (12), not on 10.
    expect(series[0]!.map((p) => p.time)).toEqual([200, 300]);
    expect(series[0]![0]!.value).toBe(0);
    expect(series[0]![1]!.value).toBeCloseTo(25, 10);
    expect(series[1]!.map((p) => p.time)).toEqual([200, 300]);
    expect(series[1]![1]!.value).toBeCloseTo(10, 10);
  });

  it("does not change series that already start together", () => {
    const a = pts([1, 10], [2, 20]);
    const b = pts([1, 5], [2, 5]);
    expect(alignPercentSeries([a, b]).series).toEqual([
      pts([1, 0], [2, 100]),
      pts([1, 0], [2, 0]),
    ]);
  });

  it("ignores an empty series when choosing the start, and leaves it empty", () => {
    const { start, series } = alignPercentSeries([pts([5, 1], [6, 2]), []]);
    expect(start).toBe(5);
    expect(series[1]).toEqual([]);
  });

  it("handles no data at all", () => {
    expect(alignPercentSeries([[], []])).toEqual({
      start: null,
      series: [[], []],
      raw: [[], []],
    });
    expect(alignPercentSeries([])).toEqual({ start: null, series: [], raw: [] });
  });

  it("does not mutate its inputs", () => {
    const a = Object.freeze([...pts([1, 1], [2, 2])]);
    expect(() => alignPercentSeries([a])).not.toThrow();
  });
});

describe("findLateStarter", () => {
  const long = pts([0, 1], [100, 1]);
  const recent = pts([60, 1], [100, 1]);

  it("names the asset whose history starts much later than the rest", () => {
    expect(findLateStarter([long, recent], 10)).toEqual({ index: 1, start: 60 });
  });

  it("stays quiet when the gap is within tolerance", () => {
    expect(findLateStarter([long, pts([5, 1], [100, 1])], 10)).toBeNull();
  });

  it("needs at least two assets with data", () => {
    expect(findLateStarter([long], 10)).toBeNull();
    expect(findLateStarter([long, []], 10)).toBeNull();
  });
});

describe("totalReturn", () => {
  it("is the last value of the aligned series", () => {
    expect(totalReturn(pts([1, 0], [2, 12.5]))).toBe(12.5);
  });

  it("is null when there are fewer than two points", () => {
    expect(totalReturn([])).toBeNull();
    expect(totalReturn(pts([1, 0]))).toBeNull();
  });
});

describe("assignColors", () => {
  it("gives new assets four clearly different hues first, in order", () => {
    const colors = assignColors(["a", "b", "c", "d"]);
    expect(Object.values(colors)).toEqual([0, 7, 3, 4]);
  });

  it("never gives two assets the same color", () => {
    const ids = ["a", "b", "c", "d"];
    const colors = assignColors(ids, { a: 3, b: 3, c: 3, d: 3 });
    expect(new Set(Object.values(colors)).size).toBe(4);
  });

  it("keeps the colors that were already chosen, whatever the order", () => {
    expect(assignColors(["a", "b", "c"], { b: 9, a: 5 })).toMatchObject({ a: 5, b: 9 });
  });

  it("gives a new asset the first default nobody has", () => {
    // a holds violet(0); b chose cyan(7): the new one skips both and takes orange(3).
    expect(assignColors(["a", "b", "c"], { a: 0, b: 7 }).c).toBe(3);
  });

  it("ignores colors that don't exist, and ids that aren't in the list", () => {
    const colors = assignColors(["a"], { a: 99, z: 2 });
    expect(colors).toEqual({ a: 0 });
    expect(assignColors(["a"], { a: -1 })).toEqual({ a: 0 });
    expect(assignColors(["a"], { a: 1.5 })).toEqual({ a: 0 });
  });

  it("returns nothing for no assets", () => {
    expect(assignColors([])).toEqual({});
  });
});

describe("withColor", () => {
  it("sets an asset's color", () => {
    expect(withColor({ a: 0, b: 7 }, "a", 5)).toEqual({ a: 5, b: 7 });
  });

  it("swaps with whoever has the color, so no two lines share one", () => {
    expect(withColor({ a: 0, b: 7 }, "a", 7)).toEqual({ a: 7, b: 0 });
  });

  it("changes nothing for a color that doesn't exist or an asset that isn't in the list", () => {
    expect(withColor({ a: 0 }, "a", 42)).toEqual({ a: 0 });
    expect(withColor({ a: 0 }, "zzz", 3)).toEqual({ a: 0 });
  });

  it("does not mutate its input", () => {
    const colors = Object.freeze({ a: 0, b: 7 });
    expect(() => withColor(colors, "a", 7)).not.toThrow();
  });

  it("is a no-op when the asset already has that color", () => {
    expect(withColor({ a: 0, b: 7 }, "a", 0)).toEqual({ a: 0, b: 7 });
  });
});

describe("COMPARE_PALETTE", () => {
  it("has ten named colors, each backed by a design token", () => {
    expect(COMPARE_PALETTE).toHaveLength(10);
    expect(new Set(COMPARE_PALETTE.map((c) => c.name)).size).toBe(10);
    expect(COMPARE_COLOR_TOKENS.every((t) => /^--chart-\d+-line$/.test(t))).toBe(true);
  });
});

describe("alignPercentSeries: raw prices", () => {
  it("returns the same shared stretch as prices, for showing dollars instead of percent", () => {
    const early = pts([100, 10], [200, 12], [300, 15]);
    const late = pts([200, 40], [300, 44]);
    const { raw } = alignPercentSeries([early, late]);
    expect(raw[0]).toEqual(pts([200, 12], [300, 15]));
    expect(raw[1]).toEqual(late);
  });
});

describe("isCompareView", () => {
  it("knows its two views", () => {
    expect(isCompareView("change")).toBe(true);
    expect(isCompareView("price")).toBe(true);
    expect(isCompareView("percent")).toBe(false);
    expect(isCompareView(null)).toBe(false);
  });
});
