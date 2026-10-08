import { describe, expect, it } from "vitest";
import {
  CHART_DAYS,
  CHUNK_DAYS,
  HISTORY_DAYS,
  historyWindow,
  isChartBack,
  maxBack,
} from "./chart";
import { mergeLineSeries } from "./chart-data";

const DAY = 86_400;
const NOW = 1_790_000_000 + 1234; // not on an hour boundary, on purpose

describe("maxBack", () => {
  it("lets short ranges scroll back almost a year, in weekly or monthly steps", () => {
    expect(maxBack("24h")).toBe(51);
    expect(maxBack("7d")).toBe(51);
    expect(maxBack("30d")).toBe(11);
  });

  it("gives the 1y chart nowhere further to go: it already holds all the history there is", () => {
    expect(maxBack("1y")).toBe(0);
  });

  it("never reaches past the history the free API serves", () => {
    // (1y is its own whole year and has no steps back, so it isn't a case here.)
    for (const range of ["24h", "7d", "30d"] as const) {
      const reach = CHART_DAYS[range] + maxBack(range) * CHUNK_DAYS[range];
      expect(reach).toBeLessThanOrEqual(HISTORY_DAYS);
    }
  });
});

describe("isChartBack", () => {
  it("accepts whole steps from 1 up to the limit", () => {
    expect(isChartBack(1, "7d")).toBe(true);
    expect(isChartBack(maxBack("7d"), "7d")).toBe(true);
  });

  it("rejects zero, negative, fractional, too far, and non-numbers", () => {
    for (const bad of [
      0,
      -1,
      1.5,
      maxBack("7d") + 1,
      9999,
      Number.NaN,
      "2",
      null,
      undefined,
    ]) {
      expect(isChartBack(bad, "7d")).toBe(false);
    }
  });

  it("rejects every step for 1y", () => {
    expect(isChartBack(1, "1y")).toBe(false);
  });
});

describe("historyWindow", () => {
  it("picks up exactly where the chart's own window starts (to the hour)", () => {
    const hour = Math.floor(NOW / 3600) * 3600;
    const { from, to } = historyWindow("7d", 1, NOW);
    expect(to).toBe(hour - 7 * DAY);
    expect(from).toBe(to - 7 * DAY);
  });

  it("each step starts where the previous one ended, with no gap and no overlap", () => {
    for (const range of ["24h", "7d", "30d"] as const) {
      for (let back = 1; back < 5; back++) {
        const newer = historyWindow(range, back, NOW);
        const older = historyWindow(range, back + 1, NOW);
        expect(older.to).toBe(newer.from);
      }
    }
  });

  it("is stable within an hour, so one hour is one cache entry however many scroll", () => {
    const a = historyWindow("30d", 2, NOW);
    const b = historyWindow("30d", 2, NOW + 1000);
    expect(b).toEqual(a);
    expect(historyWindow("30d", 2, NOW + 3600)).not.toEqual(a);
  });

  it("the furthest allowed step starts inside the history the API serves", () => {
    for (const range of ["24h", "7d", "30d"] as const) {
      const { from } = historyWindow(range, maxBack(range), NOW);
      const hour = Math.floor(NOW / 3600) * 3600;
      expect(hour - from).toBeLessThanOrEqual(HISTORY_DAYS * DAY);
    }
  });

  it("short ranges load a week at a time, not a day", () => {
    const { from, to } = historyWindow("24h", 1, NOW);
    expect(to - from).toBe(7 * DAY);
  });
});

describe("mergeLineSeries", () => {
  const pts = (...pairs: [number, number][]) =>
    pairs.map(([time, value]) => ({ time, value }));

  it("joins pieces into one ascending series", () => {
    const latest = pts([30, 3], [40, 4]);
    const older = pts([10, 1], [20, 2]);
    expect(mergeLineSeries([latest, older]).map((p) => p.time)).toEqual([10, 20, 30, 40]);
  });

  it("keeps one point per time; the piece listed first wins an overlap", () => {
    const latest = pts([20, 99], [30, 3]);
    const older = pts([10, 1], [20, 2]);
    expect(mergeLineSeries([latest, older])).toEqual(pts([10, 1], [20, 99], [30, 3]));
  });

  it("handles one piece, no pieces, and empty pieces", () => {
    expect(mergeLineSeries([pts([1, 1])])).toEqual(pts([1, 1]));
    expect(mergeLineSeries([])).toEqual([]);
    expect(mergeLineSeries([[], pts([1, 1])])).toEqual(pts([1, 1]));
  });

  it("does not mutate its input", () => {
    const a = Object.freeze([Object.freeze({ time: 2, value: 2 })]);
    const b = Object.freeze([Object.freeze({ time: 1, value: 1 })]);
    expect(() => mergeLineSeries([a, b])).not.toThrow();
  });
});
