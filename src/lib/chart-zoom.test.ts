import { describe, expect, it } from "vitest";
import { ZOOM_STEP, isNearStart, zoomLogicalRange } from "./chart-zoom";

describe("zoomLogicalRange", () => {
  it("zooms in around the middle, narrowing the view by the factor", () => {
    expect(zoomLogicalRange({ from: 0, to: 100 }, 0.5)).toEqual({ from: 25, to: 75 });
  });

  it("zooms out around the middle", () => {
    expect(zoomLogicalRange({ from: 25, to: 75 }, 2)).toEqual({ from: 0, to: 100 });
  });

  it("keeps the anchored point where it is on screen", () => {
    const before = { from: 0, to: 100 };
    const after = zoomLogicalRange(before, 0.5, 0.25); // anchored a quarter of the way in
    expect(after.from + (after.to - after.from) * 0.25).toBeCloseTo(
      before.from + (before.to - before.from) * 0.25,
    );
  });

  it("zooming toward the left edge keeps the left edge fixed", () => {
    expect(zoomLogicalRange({ from: 10, to: 110 }, 0.5, 0)).toEqual({ from: 10, to: 60 });
  });

  it("never gets narrower than minBars", () => {
    const r = zoomLogicalRange({ from: 0, to: 10 }, 0.01, 0.5, { minBars: 6 });
    expect(r.to - r.from).toBe(6);
  });

  it("never gets wider than maxBars", () => {
    const r = zoomLogicalRange({ from: 0, to: 100 }, 50, 0.5, { maxBars: 300 });
    expect(r.to - r.from).toBe(300);
  });

  it("works on a view scrolled past the start (negative bars)", () => {
    expect(zoomLogicalRange({ from: -20, to: 20 }, 0.5)).toEqual({ from: -10, to: 10 });
  });

  it("a zoom in followed by the matching zoom out returns to where it started", () => {
    const start = { from: 40, to: 140 };
    const there = zoomLogicalRange(start, ZOOM_STEP, 0.3);
    const back = zoomLogicalRange(there, 1 / ZOOM_STEP, 0.3);
    expect(back.from).toBeCloseTo(start.from);
    expect(back.to).toBeCloseTo(start.to);
  });

  it("does not mutate its input", () => {
    const range = Object.freeze({ from: 0, to: 100 });
    expect(() => zoomLogicalRange(range, 0.5)).not.toThrow();
  });
});

describe("isNearStart", () => {
  it("is true when the view reaches the first bar", () => {
    expect(isNearStart({ from: 0, to: 100 })).toBe(true);
  });

  it("is true once scrolled past the first bar", () => {
    expect(isNearStart({ from: -30, to: 70 })).toBe(true);
  });

  it("is true a little before the edge: within 40% of the view", () => {
    expect(isNearStart({ from: 30, to: 130 })).toBe(true); // 30 < 40
    expect(isNearStart({ from: 45, to: 145 })).toBe(false); // 45 > 40
  });

  it("is false in the middle of loaded data", () => {
    expect(isNearStart({ from: 300, to: 400 })).toBe(false);
  });

  it("uses a few bars as the minimum, for very zoomed-in views", () => {
    expect(isNearStart({ from: 4, to: 14 })).toBe(true); // 40% of 10 = 4, but at least 5
    expect(isNearStart({ from: 6, to: 16 })).toBe(false);
  });
});
