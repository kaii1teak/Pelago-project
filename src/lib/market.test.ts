import { describe, expect, it } from "vitest";
import { makeCoin } from "@/test/fixtures";
import { sparklineTrend, sumVolume, topMovers } from "./market";

const coin = (id: string, change24h: number | null, volume24h: number | null = 1) =>
  makeCoin({ id, change24h, volume24h });

describe("topMovers", () => {
  const coins = [
    coin("a", 5),
    coin("b", -8),
    coin("c", 12),
    coin("d", -1),
    coin("e", 0),
    coin("f", null),
  ];

  it("ranks gainers biggest-first and losers worst-first", () => {
    const { gainers, losers } = topMovers(coins, 5);
    expect(gainers.map((c) => c.id)).toEqual(["c", "a"]);
    expect(losers.map((c) => c.id)).toEqual(["b", "d"]);
  });

  it("never lists a flat or unknown coin as a mover", () => {
    const { gainers, losers } = topMovers(coins, 5);
    const ids = [...gainers, ...losers].map((c) => c.id);
    expect(ids).not.toContain("e");
    expect(ids).not.toContain("f");
  });

  it("ignores coins that round to 0.00%, even if technically positive or negative", () => {
    const { gainers, losers } = topMovers(
      [coin("a", 0.004), coin("b", -0.004), coin("c", 0.5)],
      5,
    );
    expect(gainers.map((c) => c.id)).toEqual(["c"]);
    expect(losers).toEqual([]);
  });

  it("caps each list at `count`", () => {
    const { gainers } = topMovers([coin("a", 1), coin("b", 2), coin("c", 3)], 2);
    expect(gainers.map((c) => c.id)).toEqual(["c", "b"]);
  });

  it("returns empty lists when nothing moved the right way, without throwing", () => {
    expect(topMovers([], 5)).toEqual({ gainers: [], losers: [] });
    expect(topMovers([coin("a", -1)], 5).gainers).toEqual([]);
  });

  it("doesn't mutate the input order", () => {
    const input = [coin("a", 1), coin("b", 3), coin("c", 2)];
    topMovers(input, 3);
    expect(input.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});

describe("sumVolume", () => {
  it("adds volumes and treats missing ones as zero", () => {
    expect(sumVolume([coin("a", 0, 100), coin("b", 0, null), coin("c", 0, 50)])).toBe(
      150,
    );
    expect(sumVolume([])).toBe(0);
  });
});

describe("sparklineTrend", () => {
  it("compares the last point to the first", () => {
    expect(sparklineTrend([1, 5, 2])).toBe("up");
    expect(sparklineTrend([5, 1, 4])).toBe("down");
    expect(sparklineTrend([3, 9, 3])).toBe("flat");
  });

  it("is flat when there's not enough data", () => {
    expect(sparklineTrend([])).toBe("flat");
    expect(sparklineTrend([4])).toBe("flat");
  });
});
