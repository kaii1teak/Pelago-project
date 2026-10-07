import { describe, expect, it } from "vitest";
import {
  priceMinMove,
  summarizeCandles,
  summarizeLine,
  toCandleSeries,
  toLineSeries,
} from "./chart-data";

describe("toLineSeries", () => {
  it("converts milliseconds to whole seconds", () => {
    expect(toLineSeries([[1_700_000_123_999, 5]])).toEqual([
      { time: 1_700_000_123, value: 5 },
    ]);
  });

  it("sorts ascending (the chart library throws on unordered data)", () => {
    const out = toLineSeries([
      [3000, 3],
      [1000, 1],
      [2000, 2],
    ]);
    expect(out.map((p) => p.time)).toEqual([1, 2, 3]);
  });

  it("collapses points in the same second, keeping the latest", () => {
    const out = toLineSeries([
      [5000, 1],
      [5400, 2],
      [5999, 3],
    ]);
    expect(out).toEqual([{ time: 5, value: 3 }]);
  });

  it("drops non-finite and null values instead of letting NaN reach the chart", () => {
    const out = toLineSeries([
      [1000, 1],
      [2000, null],
      [3000, Number.NaN],
      [4000, Number.POSITIVE_INFINITY],
      [null, 9],
      [5000, 5],
    ]);
    expect(out).toEqual([
      { time: 1, value: 1 },
      { time: 5, value: 5 },
    ]);
  });

  it("copes with empty input", () => {
    expect(toLineSeries([])).toEqual([]);
  });

  it("keeps a legitimate zero price", () => {
    expect(toLineSeries([[1000, 0]])).toEqual([{ time: 1, value: 0 }]);
  });
});

describe("toCandleSeries", () => {
  it("maps [ms, o, h, l, c] rows, sorted and unique", () => {
    const out = toCandleSeries([
      [2000, 2, 4, 1, 3],
      [1000, 1, 2, 0.5, 2],
    ]);
    expect(out).toEqual([
      { time: 1, open: 1, high: 2, low: 0.5, close: 2 },
      { time: 2, open: 2, high: 4, low: 1, close: 3 },
    ]);
  });

  it("drops rows with any missing field", () => {
    const out = toCandleSeries([
      [1000, 1, 2, 0.5, 2],
      [2000, 1, null, 0.5, 2],
      [3000, 1, 2, 0.5],
    ]);
    expect(out).toHaveLength(1);
  });
});

describe("summaries", () => {
  it("summarizes a line series", () => {
    const s = summarizeLine([
      { time: 1, value: 100 },
      { time: 2, value: 150 },
      { time: 3, value: 90 },
      { time: 4, value: 110 },
    ])!;
    expect(s).toMatchObject({ first: 100, last: 110, high: 150, low: 90 });
    expect(s.change).toBeCloseTo(10);
  });

  it("summarizes candles using open of the first and close of the last", () => {
    const s = summarizeCandles([
      { time: 1, open: 100, high: 130, low: 95, close: 120 },
      { time: 2, open: 120, high: 125, low: 80, close: 90 },
    ])!;
    expect(s).toMatchObject({ first: 100, last: 90, high: 130, low: 80 });
    expect(s.change).toBeCloseTo(-10);
  });

  it("returns null for no data, and doesn't divide by zero", () => {
    expect(summarizeLine([])).toBeNull();
    expect(summarizeCandles([])).toBeNull();
    expect(
      summarizeLine([
        { time: 1, value: 0 },
        { time: 2, value: 5 },
      ])!.change,
    ).toBe(0);
  });
});

describe("priceMinMove", () => {
  it("matches the precision the price is displayed with", () => {
    expect(priceMinMove(83000)).toBe(0.01);
    expect(priceMinMove(0.45)).toBe(0.0001);
    expect(priceMinMove(0.00001234)).toBe(1e-8);
  });
});
