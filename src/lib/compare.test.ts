import { describe, expect, it } from "vitest";
import {
  MAX_COMPARE,
  alignPercentSeries,
  findLateStarter,
  parseCompareIds,
  toPercentSeries,
  totalReturn,
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
    expect(alignPercentSeries([[], []])).toEqual({ start: null, series: [[], []] });
    expect(alignPercentSeries([])).toEqual({ start: null, series: [] });
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
