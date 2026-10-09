import { describe, expect, it } from "vitest";
import type { HeatCoin } from "@/lib/api/schemas";
import {
  HEAT_BREAKS,
  HEAT_PERIODS,
  buildTreemap,
  cellName,
  changeFor,
  heatFill,
  heatStep,
  neighborOf,
  placeTip,
  planLabel,
  sizeOf,
  stepWords,
  type Tile,
} from "./heatmap";

function coin(id: string, over: Partial<HeatCoin> = {}): HeatCoin {
  return {
    id,
    symbol: id.toUpperCase().slice(0, 4),
    name: id,
    image: null,
    rank: 1,
    price: 100,
    marketCap: 1000,
    volume24h: 100,
    change1h: 0.1,
    change24h: 2,
    change7d: -4,
    ...over,
  };
}

describe("changeFor / sizeOf", () => {
  const c = coin("a", { change1h: 1, change24h: 2, change7d: 3 });

  it("reads the change of the chosen period", () => {
    expect(changeFor(c, "1h")).toBe(1);
    expect(changeFor(c, "24h")).toBe(2);
    expect(changeFor(c, "7d")).toBe(3);
  });

  it("treats a missing or non-finite change as none", () => {
    expect(changeFor(coin("a", { change7d: null }), "7d")).toBeNull();
    expect(changeFor(coin("a", { change7d: Number.NaN }), "7d")).toBeNull();
  });

  it("sizes by market cap or by volume, and never by a number that can't be drawn", () => {
    expect(sizeOf(c, "cap")).toBe(1000);
    expect(sizeOf(c, "volume")).toBe(100);
    expect(sizeOf(coin("a", { marketCap: null }), "cap")).toBe(0);
    expect(sizeOf(coin("a", { volume24h: 0 }), "volume")).toBe(0);
    expect(sizeOf(coin("a", { marketCap: -5 }), "cap")).toBe(0);
  });
});

describe("heatStep", () => {
  it("has seven steps, symmetric around a flat middle", () => {
    const [weak, medium, strong] = HEAT_BREAKS["24h"];
    expect(heatStep(0, "24h")).toBe(0);
    expect(heatStep(weak - 0.01, "24h")).toBe(0);
    expect(heatStep(weak, "24h")).toBe(1);
    expect(heatStep(medium, "24h")).toBe(2);
    expect(heatStep(strong, "24h")).toBe(3);
    expect(heatStep(-weak, "24h")).toBe(-1);
    expect(heatStep(-medium, "24h")).toBe(-2);
    expect(heatStep(-strong - 50, "24h")).toBe(-3);
  });

  it("asks for a bigger move over a longer period", () => {
    // +2% is a strong hour, a notable day and nothing much for a week.
    expect(heatStep(2, "1h")).toBe(3);
    expect(heatStep(2, "24h")).toBe(1);
    expect(heatStep(2, "7d")).toBe(0);
  });

  it("keeps every period's thresholds ascending", () => {
    for (const period of HEAT_PERIODS) {
      const [a, b, c] = HEAT_BREAKS[period];
      expect(a).toBeLessThan(b);
      expect(b).toBeLessThan(c);
    }
  });

  it("is null for an unknown change, not flat", () => {
    expect(heatStep(null, "24h")).toBeNull();
    expect(heatStep(Number.NaN, "24h")).toBeNull();
  });
});

describe("heatFill / stepWords", () => {
  it("names the fill variable of each step", () => {
    expect(heatFill(3)).toBe("var(--heat-up-3)");
    expect(heatFill(1)).toBe("var(--heat-up-1)");
    expect(heatFill(0)).toBe("var(--heat-flat)");
    expect(heatFill(-2)).toBe("var(--heat-down-2)");
    expect(heatFill(null)).toBe("var(--heat-none)");
  });

  it("says what a step means in plain words", () => {
    expect(stepWords(3, "24h")).toBe("up more than 6%");
    expect(stepWords(-2, "24h")).toBe("down 3% to 6%");
    expect(stepWords(0, "7d")).toBe("within 3% either way");
  });
});

describe("buildTreemap", () => {
  const coins = [
    coin("btc", { marketCap: 600 }),
    coin("eth", { marketCap: 300 }),
    coin("xrp", { marketCap: 60 }),
    coin("ada", { marketCap: 40 }),
  ];
  const box = { width: 1000, height: 600, size: "cap" as const, universe: 100 };

  it("gives each coin an area in proportion to its size, inside the box", () => {
    const { tiles, skipped } = buildTreemap(coins, box);
    expect(skipped).toBe(0);
    expect(tiles).toHaveLength(4);
    const area = (t: Tile) => t.w * t.h;
    const total = tiles.reduce((sum, t) => sum + area(t), 0);
    // The cells tile the whole box (rounding to whole pixels moves edges by under a pixel).
    expect(total).toBeCloseTo(1000 * 600, -3);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x + t.w).toBeLessThanOrEqual(1000);
      expect(t.y + t.h).toBeLessThanOrEqual(600);
    }
    const share = (id: string) => area(tiles.find((t) => t.coin.id === id)!) / total;
    expect(share("btc")).toBeCloseTo(0.6, 1);
    expect(share("eth")).toBeCloseTo(0.3, 1);
    expect(share("ada")).toBeCloseTo(0.04, 1);
  });

  it("keeps the order the coins came in, whatever their sizes: a cell keeps its place in the list", () => {
    const { tiles } = buildTreemap([coins[1]!, coins[3]!, coins[0]!, coins[2]!], box);
    expect(tiles.map((t) => t.coin.id)).toEqual(["eth", "ada", "btc", "xrp"]);
  });

  it("takes only the first `universe` coins", () => {
    const { tiles } = buildTreemap(coins, { ...box, universe: 2 });
    expect(tiles.map((t) => t.coin.id)).toEqual(["btc", "eth"]);
  });

  it("can size by volume instead", () => {
    const { tiles } = buildTreemap(
      [
        coin("a", { marketCap: 900, volume24h: 10 }),
        coin("b", { marketCap: 100, volume24h: 90 }),
      ],
      { ...box, size: "volume" },
    );
    const area = (id: string) => {
      const t = tiles.find((x) => x.coin.id === id)!;
      return t.w * t.h;
    };
    expect(area("b")).toBeGreaterThan(area("a"));
    // ...and the list is still in rank order, so switching metric moves cells instead of rebuilding them.
    expect(tiles.map((t) => t.coin.id)).toEqual(["a", "b"]);
  });

  it("counts coins it cannot draw instead of crashing on them", () => {
    const { tiles, skipped } = buildTreemap(
      [coin("a"), coin("b", { marketCap: null }), coin("c", { marketCap: 0 })],
      box,
    );
    expect(tiles.map((t) => t.coin.id)).toEqual(["a"]);
    expect(skipped).toBe(2);
  });

  it("drops a coin so small that it rounds to nothing, and counts it", () => {
    const { tiles, skipped } = buildTreemap(
      [coin("big", { marketCap: 1e12 }), coin("dust", { marketCap: 1 })],
      { ...box, width: 100, height: 100 },
    );
    expect(tiles.map((t) => t.coin.id)).toEqual(["big"]);
    expect(skipped).toBe(1);
  });

  it("is empty for no coins or no room", () => {
    expect(buildTreemap([], box).tiles).toEqual([]);
    expect(buildTreemap(coins, { ...box, width: 0 }).tiles).toEqual([]);
    expect(buildTreemap(coins, { ...box, height: -5 }).tiles).toEqual([]);
  });

  it("uses whole pixels, so the gaps between cells are exact", () => {
    const { tiles } = buildTreemap(coins, { ...box, width: 777, height: 433 });
    for (const t of tiles) {
      for (const n of [t.x, t.y, t.w, t.h]) expect(Number.isInteger(n)).toBe(true);
    }
  });
});

describe("planLabel", () => {
  const text = { ticker: "BTC", change: "+2.31%", price: "$84,228.00" };

  it("says everything in a large cell, and in a larger size than in a small one", () => {
    const big = planLabel(400, 260, text)!;
    const small = planLabel(120, 90, text)!;
    expect(big.lines).toEqual(["ticker", "change", "price"]);
    expect(big.fontSize).toBeGreaterThan(small.fontSize);
  });

  it("gives up the price first, then the change, as the cell shrinks", () => {
    expect(planLabel(150, 44, text)!.lines).toEqual(["ticker", "change"]);
    expect(planLabel(46, 26, text)!.lines).toEqual(["ticker"]);
  });

  it("says nothing in a cell too small for its ticker", () => {
    expect(planLabel(20, 20, text)).toBeNull();
    expect(planLabel(10, 40, text)).toBeNull();
    expect(planLabel(0, 0, text)).toBeNull();
  });

  it("never lets a line run past the cell, whatever the cell", () => {
    for (const w of [30, 48, 64, 90, 140, 260, 520]) {
      for (const h of [20, 30, 48, 70, 120, 300]) {
        const plan = planLabel(w, h, text);
        if (!plan) continue;
        const widest = Math.max(
          ...plan.lines.map(
            (line) =>
              text[line].length * 0.6 * plan.fontSize * (line === "ticker" ? 1 : 0.9),
          ),
        );
        expect(widest).toBeLessThanOrEqual(w - 12 + 0.01);
        expect(plan.baselines.at(-1)!).toBeLessThanOrEqual(h - 6 + 1);
      }
    }
  });

  it("puts each line below the last", () => {
    const plan = planLabel(300, 200, text)!;
    for (let i = 1; i < plan.baselines.length; i++) {
      expect(plan.baselines[i]!).toBeGreaterThan(plan.baselines[i - 1]!);
    }
  });

  it("fits a longer ticker by shrinking, then by dropping the lines", () => {
    const long = { ...text, ticker: "WBTCUSD" };
    const a = planLabel(100, 80, text)!;
    const b = planLabel(100, 80, long);
    expect(b === null || b.fontSize <= a.fontSize).toBe(true);
  });
});

describe("neighborOf", () => {
  // A 2 x 2 grid with one tall cell on the right.
  const tile = (id: string, x: number, y: number, w: number, h: number): Tile => ({
    coin: coin(id),
    x,
    y,
    w,
    h,
  });
  const tiles = [
    tile("a", 0, 0, 100, 100),
    tile("b", 0, 100, 100, 100),
    tile("c", 100, 0, 100, 200),
    tile("d", 200, 0, 50, 50),
  ];

  it("moves to the cell that lies that way", () => {
    expect(neighborOf(tiles, "a", "down")).toBe("b");
    expect(neighborOf(tiles, "b", "up")).toBe("a");
    expect(neighborOf(tiles, "a", "right")).toBe("c");
    expect(neighborOf(tiles, "c", "left")).toBe("a");
    expect(neighborOf(tiles, "c", "right")).toBe("d");
  });

  it("prefers the cell straight ahead over one that is nearer but off to the side", () => {
    expect(neighborOf(tiles, "b", "right")).toBe("c");
  });

  it("does nothing at an edge", () => {
    expect(neighborOf(tiles, "a", "up")).toBeNull();
    expect(neighborOf(tiles, "a", "left")).toBeNull();
    expect(neighborOf(tiles, "d", "right")).toBeNull();
  });

  it("is null for a cell that isn't there", () => {
    expect(neighborOf(tiles, "zzz", "down")).toBeNull();
  });

  it("can reach every cell of a real layout from the first one (nobody is stranded)", () => {
    const real = buildTreemap(
      Array.from({ length: 60 }, (_, i) => coin(`c${i}`, { marketCap: 1000 / (i + 1) })),
      { width: 900, height: 520, size: "cap", universe: 100 },
    ).tiles;
    const seen = new Set<string>([real[0]!.coin.id]);
    const queue = [real[0]!.coin.id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const dir of ["left", "right", "up", "down"] as const) {
        const next = neighborOf(real, id, dir);
        if (next && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect(seen.size).toBe(real.length);
  });
});

describe("cellName", () => {
  it("is a full sentence, so no cell depends on its colour or its label", () => {
    const name = cellName(
      coin("bitcoin", { name: "Bitcoin", symbol: "BTC", rank: 1, marketCap: 1.7e12 }),
      "24h",
      84228,
      2.314,
    );
    expect(name).toBe(
      "Bitcoin (BTC), rank 1, $84,228.00, +2.31% over 24 hours, market cap $1.7T",
    );
  });

  it("says so when there is no change for the period", () => {
    expect(cellName(coin("x", { name: "X", symbol: "X" }), "7d", null, null)).toContain(
      "no 7 days change",
    );
  });
});

describe("placeTip", () => {
  const frame = { w: 800, h: 500 };
  const tip = { w: 200, h: 120 };

  it("sits below and to the right of the pointer", () => {
    expect(placeTip({ x: 100, y: 100 }, tip, frame)).toEqual({ left: 114, top: 114 });
  });

  it("flips to the left of the pointer at the right edge", () => {
    expect(placeTip({ x: 700, y: 100 }, tip, frame).left).toBe(700 - 14 - 200);
  });

  it("flips above the pointer at the bottom edge", () => {
    expect(placeTip({ x: 100, y: 450 }, tip, frame).top).toBe(450 - 14 - 120);
  });

  it("stays inside the frame in every corner", () => {
    for (const x of [0, 10, 400, 790, 800]) {
      for (const y of [0, 10, 250, 490, 500]) {
        const { left, top } = placeTip({ x, y }, tip, frame);
        expect(left).toBeGreaterThanOrEqual(0);
        expect(top).toBeGreaterThanOrEqual(0);
        expect(left + tip.w).toBeLessThanOrEqual(frame.w);
        expect(top + tip.h).toBeLessThanOrEqual(frame.h);
      }
    }
  });

  it("holds a tooltip wider than the frame at the left edge", () => {
    expect(placeTip({ x: 50, y: 50 }, { w: 400, h: 100 }, { w: 300, h: 300 }).left).toBe(
      0,
    );
  });
});
