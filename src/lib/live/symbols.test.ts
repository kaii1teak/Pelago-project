import { describe, expect, it } from "vitest";
import { MAX_LIVE_RANK, isPlausible, liveChange24h, liveSymbol } from "./symbols";

describe("liveSymbol", () => {
  it("is the ticker against USDT", () => {
    expect(liveSymbol("BTC")).toBe("BTCUSDT");
    expect(liveSymbol("btc")).toBe("BTCUSDT");
    expect(liveSymbol(" eth ")).toBe("ETHUSDT");
    expect(liveSymbol("1INCH")).toBe("1INCHUSDT");
  });

  it("is null for a ticker that can't be a Binance symbol", () => {
    for (const bad of [
      "",
      "$MYRO",
      "A B",
      "BTC/USD",
      "W-BTC",
      "THISISWAYTOOLONGTOBEATICKER",
    ]) {
      expect(liveSymbol(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("is null beyond the top 300, where a ticker is as likely to be another coin's", () => {
    expect(liveSymbol("BTC", 1)).toBe("BTCUSDT");
    expect(liveSymbol("XYZ", MAX_LIVE_RANK)).toBe("XYZUSDT");
    expect(liveSymbol("XYZ", MAX_LIVE_RANK + 1)).toBeNull();
    expect(liveSymbol("XYZ", null)).toBe("XYZUSDT"); // an unknown rank is not a bad one
  });
});

describe("isPlausible", () => {
  it("accepts a price near the polled one", () => {
    expect(isPlausible(100, 100)).toBe(true);
    expect(isPlausible(104, 100)).toBe(true);
    expect(isPlausible(96, 100)).toBe(true);
    expect(isPlausible(109.9, 100)).toBe(true); // just inside the 10% line
    expect(isPlausible(110.5, 100)).toBe(false); // just outside
  });

  it("rejects one that is far off: the same ticker, another coin", () => {
    expect(isPlausible(112, 100)).toBe(false);
    expect(isPlausible(88, 100)).toBe(false);
    expect(isPlausible(0.5, 100)).toBe(false);
    expect(isPlausible(100_000, 3)).toBe(false);
  });

  it("accepts any real price when there is nothing to compare it with", () => {
    expect(isPlausible(5, null)).toBe(true);
    expect(isPlausible(5, undefined)).toBe(true);
    expect(isPlausible(5, 0)).toBe(true);
  });

  it("never accepts a price that isn't one", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isPlausible(bad, null), String(bad)).toBe(false);
    }
  });
});

describe("liveChange24h", () => {
  it("measures from the price a day ago that the polled price and change imply", () => {
    // polled: 110 after a +10% day, so a day ago it was 100
    expect(liveChange24h(110, 110, 10)).toBeCloseTo(10);
    expect(liveChange24h(121, 110, 10)).toBeCloseTo(21);
    expect(liveChange24h(90, 110, 10)).toBeCloseTo(-10);
  });

  it("works for a falling coin", () => {
    // polled: 90 after a -10% day, so a day ago it was 100
    expect(liveChange24h(99, 90, -10)).toBeCloseTo(-1);
  });

  it("is null when the polled numbers can't give a reference", () => {
    expect(liveChange24h(100, null, 5)).toBeNull();
    expect(liveChange24h(100, 100, null)).toBeNull();
    expect(liveChange24h(100, 0, 5)).toBeNull();
    expect(liveChange24h(100, 100, -100)).toBeNull();
    expect(liveChange24h(100, 100, -150)).toBeNull();
  });
});
