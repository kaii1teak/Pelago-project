import { describe, expect, it } from "vitest";
import {
  directionOf,
  formatCompactUsd,
  formatDate,
  formatPercent,
  formatPlainPercent,
  formatUsd,
  priceDigits,
} from "./format";

describe("formatUsd", () => {
  it("uses 2 decimals at or above $1", () => {
    expect(formatUsd(67432.1)).toBe("$67,432.10");
    expect(formatUsd(1)).toBe("$1.00");
  });

  it("adds precision for cheap coins so the price stays meaningful", () => {
    expect(formatUsd(0.4521)).toBe("$0.4521");
    expect(formatUsd(0.00123)).toBe("$0.001230");
    expect(formatUsd(0.00001234)).toBe("$0.00001234");
  });

  it("formats negatives and tolerates missing data", () => {
    expect(formatUsd(-5)).toBe("-$5.00");
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(undefined)).toBe("—");
    expect(formatUsd(Number.NaN)).toBe("—");
  });
});

describe("priceDigits", () => {
  it.each([
    [1000, 2],
    [1, 2],
    [0.99, 4],
    [0.01, 4],
    [0.0099, 6],
    [0.0001, 6],
    [0.00009, 8],
  ])("%d -> %d decimals", (value, digits) => {
    expect(priceDigits(value)).toBe(digits);
  });
});

describe("formatCompactUsd", () => {
  it("abbreviates large values", () => {
    expect(formatCompactUsd(2_410_000_000_000)).toBe("$2.41T");
    expect(formatCompactUsd(84_200_000_000)).toBe("$84.2B");
    expect(formatCompactUsd(950_000)).toBe("$950K");
  });

  it("handles missing data", () => {
    expect(formatCompactUsd(null)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("always shows a sign for non-zero values", () => {
    expect(formatPercent(1.234)).toBe("+1.23%");
    expect(formatPercent(-0.5)).toBe("-0.50%");
  });

  it("never shows a signed zero", () => {
    expect(formatPercent(0)).toBe("0.00%");
    expect(formatPercent(0.001)).toBe("0.00%");
    expect(formatPercent(-0.001)).toBe("0.00%");
  });

  it("respects digits and missing data", () => {
    expect(formatPercent(12.3456, 1)).toBe("+12.3%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatPlainPercent", () => {
  it("is unsigned", () => {
    expect(formatPlainPercent(52.41)).toBe("52.4%");
    expect(formatPlainPercent(undefined)).toBe("—");
  });
});

describe("directionOf", () => {
  it("classifies after rounding, so +0.004% is flat, not up", () => {
    expect(directionOf(1.2)).toBe("up");
    expect(directionOf(-1.2)).toBe("down");
    expect(directionOf(0.004)).toBe("flat");
    expect(directionOf(-0.004)).toBe("flat");
    expect(directionOf(null)).toBe("flat");
  });
});

describe("formatDate", () => {
  it("is timezone-independent (UTC)", () => {
    expect(formatDate("2026-01-15T23:59:59Z")).toBe("Jan 15, 2026");
  });

  it("handles missing and invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not a date")).toBe("—");
  });
});
