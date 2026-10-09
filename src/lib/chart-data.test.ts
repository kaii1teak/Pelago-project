import { describe, expect, it } from "vitest";
import {
  candlePeriod,
  liveLinePoint,
  nextLiveCandle,
  priceMinMove,
  summarizeCandles,
  summarizeLine,
  toCandleSeries,
  toLineSeries,
  type Candle,
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

describe("liveLinePoint", () => {
  it("moves the end of the line to the live price, at the last time the history has", () => {
    const line = [
      { time: 100, value: 10 },
      { time: 200, value: 12 },
    ];
    expect(liveLinePoint(line, { price: 13 })).toEqual({ time: 200, value: 13 });
  });

  it("is nothing for an empty history", () => {
    expect(liveLinePoint([], { price: 13 })).toBeNull();
  });
});

describe("candlePeriod", () => {
  const candle = (time: number) => ({ time, open: 1, high: 1, low: 1, close: 1 });
  it("is the gap between the last two candles", () => {
    expect(candlePeriod([candle(0), candle(1800), candle(3600)])).toBe(1800);
    expect(candlePeriod([candle(0), candle(14400)])).toBe(14400);
  });
  it("is unknown with fewer than two candles", () => {
    expect(candlePeriod([])).toBeNull();
    expect(candlePeriod([candle(0)])).toBeNull();
  });
});

describe("nextLiveCandle", () => {
  const history: Candle[] = [
    { time: 0, open: 100, high: 105, low: 98, close: 102 },
    { time: 1800, open: 102, high: 108, low: 101, close: 106 },
  ];

  it("stretches the last candle while the sample is inside its slot", () => {
    expect(nextLiveCandle(history, null, { price: 107, time: 2000 })).toEqual({
      time: 1800,
      open: 102,
      high: 108,
      low: 101,
      close: 107,
    });
  });

  it("widens the high and low to include the price, and the streamed minute's own extremes", () => {
    expect(nextLiveCandle(history, null, { price: 110, time: 2000 })).toMatchObject({
      high: 110,
      close: 110,
    });
    expect(nextLiveCandle(history, null, { price: 100, time: 2000 })).toMatchObject({
      low: 100,
      close: 100,
    });
    expect(
      nextLiveCandle(history, null, { price: 107, high: 112, low: 99, time: 2000 }),
    ).toMatchObject({ high: 112, low: 99, close: 107 });
  });

  it("keeps a spike from an earlier price: the high never narrows within a slot", () => {
    const afterSpike = nextLiveCandle(history, null, { price: 115, time: 2000 })!;
    expect(nextLiveCandle(history, afterSpike, { price: 109, time: 2100 })).toMatchObject(
      {
        high: 115,
        close: 109,
      },
    );
  });

  it("starts a new candle once the sample is past the slot, opening where the last one closed", () => {
    expect(nextLiveCandle(history, null, { price: 107, time: 3700 })).toEqual({
      time: 3600,
      open: 106,
      high: 107,
      low: 106,
      close: 107,
    });
  });

  it("puts a sample several slots ahead in the slot it falls in", () => {
    expect(
      nextLiveCandle(history, null, { price: 107, time: 1800 + 1800 * 5 + 10 }),
    ).toMatchObject({
      time: 1800 + 1800 * 5,
    });
  });

  it("carries the new candle forward: its open stays, its range grows", () => {
    const first = nextLiveCandle(history, null, { price: 107, time: 3700 })!;
    expect(nextLiveCandle(history, first, { price: 104, time: 3800 })).toEqual({
      time: 3600,
      open: 106,
      high: 107,
      low: 104,
      close: 104,
    });
  });

  it("opens a following candle at the previous live close", () => {
    const first = nextLiveCandle(history, null, { price: 107, time: 3700 })!;
    expect(nextLiveCandle(history, first, { price: 108, time: 5500 })).toMatchObject({
      time: 5400,
      open: 107,
    });
  });

  it("never goes back before the last candle", () => {
    expect(nextLiveCandle(history, null, { price: 107, time: 100 })!.time).toBe(1800);
  });

  it("with a single candle and so no known slot, keeps updating it", () => {
    expect(
      nextLiveCandle([history[0]!], null, { price: 120, time: 999_999 }),
    ).toMatchObject({
      time: 0,
      close: 120,
      high: 120,
    });
  });

  it("is nothing without history", () => {
    expect(nextLiveCandle([], null, { price: 1, time: 1 })).toBeNull();
  });
});
