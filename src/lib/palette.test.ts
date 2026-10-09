import { describe, expect, it } from "vitest";
import { NAV_LINKS } from "./site";
import {
  assetHref,
  buildGroups,
  commandMatches,
  flattenGroups,
  fromMarket,
  itemKey,
  matchScore,
  pageItems,
  searchAssets,
  shortcutsItem,
  themeItem,
  type PaletteAsset,
} from "./palette";
import { makeCoin } from "@/test/fixtures";

const a = (
  id: string,
  name: string,
  symbol: string,
  rank: number | null,
): PaletteAsset => ({
  id,
  name,
  symbol,
  rank,
  image: null,
});
const BTC = a("bitcoin", "Bitcoin", "BTC", 1);
const ETH = a("ethereum", "Ethereum", "ETH", 2);
const BCH = a("bitcoin-cash", "Bitcoin Cash", "BCH", 18);
const WBTC = a("wrapped-bitcoin", "Wrapped Bitcoin", "WBTC", 12);
const OBSCURE = a("bitcoin-obscure", "Obscure Bit Token", "OBT", null);

describe("matchScore", () => {
  it("ranks exact, symbol-prefix, name-prefix, word-prefix and contains in that order", () => {
    expect(matchScore(BTC, "btc")).toBe(0); // exact symbol
    expect(matchScore(BTC, "bitcoin")).toBe(0); // exact name
    expect(matchScore(BCH, "bc")).toBe(1); // symbol prefix
    expect(matchScore(BCH, "bitcoin c")).toBe(2); // name prefix
    expect(matchScore(WBTC, "bitc")).toBe(3); // a word of the name
    expect(matchScore(WBTC, "rapped")).toBe(4); // inside
  });

  it("returns null when nothing matches", () => {
    expect(matchScore(BTC, "zzz")).toBeNull();
  });

  it("matches on the id too (a renamed coin keeps its old slug)", () => {
    expect(matchScore(a("old-slug", "New Name", "NEW", 5), "old-slug")).toBe(0);
  });
});

describe("searchAssets", () => {
  it("puts the exact match first, then bigger assets before smaller ones", () => {
    const result = searchAssets("bitcoin", [WBTC, BCH, BTC, ETH], [], 8);
    expect(result.map((x) => x.id)).toEqual([
      "bitcoin",
      "bitcoin-cash",
      "wrapped-bitcoin",
    ]);
  });

  it("breaks ties by market-cap rank, with unranked assets last", () => {
    const result = searchAssets("bit", [OBSCURE, BCH, BTC], [], 8);
    expect(result.map((x) => x.id)).toEqual([
      "bitcoin",
      "bitcoin-cash",
      "bitcoin-obscure",
    ]);
  });

  it("finds assets outside the top list through the remote results", () => {
    const rare = a("some-rare-coin", "Rare Coin", "RARE", 4000);
    const result = searchAssets("rare", [BTC, ETH], [rare], 8);
    expect(result).toEqual([rare]);
  });

  it("does not list an asset twice when both sources have it", () => {
    const result = searchAssets("bit", [BTC], [BTC, BCH], 8);
    expect(result.map((x) => x.id)).toEqual(["bitcoin", "bitcoin-cash"]);
  });

  it("trusts a remote result even when it can't see why it matched, ranked after real matches", () => {
    const odd = a("mystery", "Mystery", "MYS", 3); // matched upstream on something else
    const result = searchAssets("bitcoin", [BTC], [odd], 8);
    expect(result.map((x) => x.id)).toEqual(["bitcoin", "mystery"]);
  });

  it("keeps only the best `limit`", () => {
    expect(searchAssets("bit", [BTC, BCH, WBTC], [], 2)).toHaveLength(2);
  });

  it("shows local matches instantly, with no remote answer yet", () => {
    expect(searchAssets("eth", [BTC, ETH], [], 8)).toEqual([ETH]);
  });

  it("does not mutate its inputs", () => {
    const local = Object.freeze([BTC, ETH]);
    const remote = Object.freeze([BCH]);
    expect(() => searchAssets("b", local, remote, 8)).not.toThrow();
  });
});

describe("fromMarket", () => {
  it("keeps just the fields the palette shows", () => {
    expect(
      fromMarket(makeCoin({ id: "bitcoin", name: "Bitcoin", symbol: "BTC", rank: 1 })),
    ).toEqual({
      id: "bitcoin",
      name: "Bitcoin",
      symbol: "BTC",
      rank: 1,
      image: null,
    });
  });
});

describe("commands", () => {
  const pages = pageItems(NAV_LINKS);

  it("lists Home and every page in the navigation", () => {
    expect(pages.map((p) => p.label)).toEqual([
      "Home",
      "Markets",
      "Heatmap",
      "Watchlist",
      "Compare",
    ]);
    expect(pages.map((p) => p.href)).toEqual([
      "/",
      "/markets",
      "/heatmap",
      "/watchlist",
      "/compare",
    ]);
  });

  it("offers the theme the page is not in", () => {
    expect(themeItem("dark").label).toBe("Switch to light theme");
    expect(themeItem("light").label).toBe("Switch to dark theme");
  });

  it("shows each page's keyboard shortcut beside it, as the catalog has it", () => {
    expect(pages.map((p) => p.hotkey)).toEqual([
      "go.home",
      "go.markets",
      "go.heatmap",
      "go.watchlist",
      "go.compare",
    ]);
    expect(themeItem("dark").hotkey).toBe("theme");
    expect(shortcutsItem().hotkey).toBe("shortcuts");
  });

  it("offers the keyboard shortcuts overlay, found by what people call it", () => {
    const item = shortcutsItem();
    expect(item.label).toBe("Keyboard shortcuts");
    for (const word of ["keyboard", "hotkeys", "keys", "help", "short"]) {
      expect(commandMatches(item, word), word).toBe(true);
    }
    expect(commandMatches(item, "bitcoin")).toBe(false);
  });

  it("matches a page by the start of any word", () => {
    const markets = pages.find((p) => p.label === "Markets")!;
    expect(commandMatches(markets, "mark")).toBe(true);
    expect(commandMatches(markets, "arket")).toBe(false);
  });

  it("matches the theme action by its keywords", () => {
    const theme = themeItem("dark");
    for (const word of ["theme", "dark", "light", "appear", "mode"]) {
      expect(commandMatches(theme, word)).toBe(true);
    }
    expect(commandMatches(theme, "bitcoin")).toBe(false);
  });
});

describe("buildGroups", () => {
  const pages = pageItems(NAV_LINKS);
  const base = {
    theme: "dark" as const,
    pages,
    assets: [] as PaletteAsset[],
    topAssets: [BTC, ETH],
  };

  it("with nothing typed, is a launchpad: pages, the theme switch and top assets", () => {
    const groups = buildGroups({ ...base, query: "" });
    expect(groups.map((g) => g.id)).toEqual(["pages", "actions", "assets"]);
    expect(groups[2]!.label).toBe("Top assets");
    expect(groups[2]!.items.map((i) => i.id)).toEqual(["bitcoin", "ethereum"]);
  });

  it("shows at most five top assets", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      a(`c${i}`, `Coin ${i}`, `C${i}`, i + 1),
    );
    const groups = buildGroups({ ...base, query: "", topAssets: many });
    expect(groups.find((g) => g.id === "assets")!.items).toHaveLength(5);
  });

  it("with a query, keeps only the pages and actions that answer to it, then the assets", () => {
    const groups = buildGroups({ ...base, query: "mark", assets: [BTC] });
    expect(groups.map((g) => g.id)).toEqual(["pages", "assets"]);
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["/markets"]);
    expect(groups[1]!.label).toBe("Assets");
  });

  it("drops groups with nothing in them (no results at all gives no groups)", () => {
    expect(buildGroups({ ...base, query: "zzzz" })).toEqual([]);
  });

  it("finds the theme action by what people call it", () => {
    const groups = buildGroups({ ...base, query: "dark" });
    expect(groups.map((g) => g.id)).toEqual(["actions"]);
  });

  it("links every asset to its page, with the id encoded", () => {
    const [group] = buildGroups({ ...base, query: "bit", assets: [BTC] }).filter(
      (g) => g.id === "assets",
    );
    expect(group!.items[0]).toMatchObject({ kind: "asset", href: "/coin/bitcoin" });
    expect(assetHref("a b/c")).toBe("/coin/a%20b%2Fc");
  });

  it("flattens in on-screen order, with a unique key per item", () => {
    const flat = flattenGroups(buildGroups({ ...base, query: "" }));
    expect(flat.map((i) => i.kind)).toEqual([
      "page",
      "page",
      "page",
      "page",
      "page",
      "action",
      "action",
      "asset",
      "asset",
    ]);
    const keys = flat.map(itemKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
