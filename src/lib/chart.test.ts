import { describe, expect, it } from "vitest";
import {
  CHART_DAYS,
  CHART_RANGES,
  COIN_ID_PATTERN,
  isChartMode,
  isChartRange,
} from "./chart";

describe("chart vocabulary", () => {
  it("maps every range to CoinGecko's day count (1y is the free-tier maximum)", () => {
    expect(CHART_RANGES.map((r) => CHART_DAYS[r])).toEqual([1, 7, 30, 365]);
  });

  it("guards ranges and modes", () => {
    expect(isChartRange("7d")).toBe(true);
    expect(isChartRange("5y")).toBe(false);
    expect(isChartRange(7)).toBe(false);
    expect(isChartMode("candle")).toBe(true);
    expect(isChartMode("area")).toBe(false);
  });

  it.each(["bitcoin", "usd-coin", "wrapped-bitcoin", "coin.with.dots", "a", "x_y"])(
    "accepts coin id %s",
    (id) => {
      expect(COIN_ID_PATTERN.test(id)).toBe(true);
    },
  );

  it.each([
    "",
    "Bitcoin",
    "-bitcoin",
    "bit coin",
    "../etc",
    "a/b",
    "a?b=c",
    "x".repeat(101),
    "bitcoin\n",
  ])("rejects coin id %j", (id) => {
    expect(COIN_ID_PATTERN.test(id)).toBe(false);
  });
});
