import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATE,
  defaultUniverse,
  heatmapStateToSearch,
  parseHeatmapState,
} from "./heatmap-url";

const parse = (qs: string) => parseHeatmapState(new URLSearchParams(qs));

describe("parseHeatmapState", () => {
  it("is the default for a plain URL", () => {
    expect(parse("")).toEqual(DEFAULT_STATE);
  });

  it("reads every field", () => {
    expect(parse("period=7d&size=volume&top=200&category=layer-1")).toEqual({
      period: "7d",
      size: "volume",
      top: 200,
      category: "layer-1",
    });
  });

  it.each([
    "period=1y",
    "period=",
    "size=price",
    "top=75",
    "top=abc",
    "top=-50",
    "category=made-up",
    "category=x&category=y",
  ])("falls back to the default for a bad value (%s)", (qs) => {
    expect(parse(qs)).toEqual(DEFAULT_STATE);
  });

  it("keeps the good fields when one is bad", () => {
    expect(parse("period=1h&top=3&size=nope")).toEqual({
      ...DEFAULT_STATE,
      period: "1h",
    });
  });
});

describe("heatmapStateToSearch", () => {
  it("leaves out defaults", () => {
    expect(heatmapStateToSearch(DEFAULT_STATE)).toBe("");
  });

  it("round-trips", () => {
    const state = {
      period: "1h",
      size: "volume",
      top: 50,
      category: "depin",
    } as const;
    expect(parse(heatmapStateToSearch(state))).toEqual(state);
  });

  it("writes only what differs", () => {
    expect(heatmapStateToSearch({ ...DEFAULT_STATE, period: "7d" })).toBe("period=7d");
  });
});

describe("defaultUniverse", () => {
  it("is smaller on a phone", () => {
    expect(defaultUniverse(true)).toBe(50);
    expect(defaultUniverse(false)).toBe(100);
  });
});
