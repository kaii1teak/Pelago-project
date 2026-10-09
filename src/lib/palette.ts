import type { MarketCoin, SearchResult } from "@/lib/api/schemas";
import type { HotkeyId } from "@/lib/hotkeys/catalog";
import type { Theme } from "@/lib/theme";
import type { NavLink } from "@/lib/site";

/** What the palette needs to know about an asset: the shape the search API returns. */
export type PaletteAsset = SearchResult;

export const fromMarket = (c: MarketCoin): PaletteAsset => ({
  id: c.id,
  name: c.name,
  symbol: c.symbol,
  rank: c.rank,
  image: c.image,
});

/* ---- ranking ------------------------------------------------------------- */

/** A match that is only the remote search's say-so (it matched on something we can't see). */
const REMOTE_ONLY = 5;

/**
 * How well an asset matches what was typed, lower is better, null is no match:
 *   0 exact (symbol, name or id)   1 symbol starts with it   2 name starts with it
 *   3 a word of the name starts with it   4 it appears somewhere inside
 * `query` is already normalized (trimmed, lower case).
 */
export function matchScore(asset: PaletteAsset, query: string): number | null {
  const name = asset.name.toLowerCase();
  const symbol = asset.symbol.toLowerCase();
  const id = asset.id.toLowerCase();
  if (symbol === query || name === query || id === query) return 0;
  if (symbol.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (name.split(/[\s._-]+/).some((word) => word.startsWith(query))) return 3;
  if (name.includes(query) || symbol.includes(query) || id.includes(query)) return 4;
  return null;
}

const rankOf = (a: PaletteAsset) => a.rank ?? Number.POSITIVE_INFINITY;

/**
 * The assets to show for a query, best first. `local` is what we already hold
 * (the top assets, available instantly); `remote` is the search API's answer for
 * the whole market. Both are merged without duplicates: anything the remote search
 * returned counts as a match even if we can't see why, but ranks after real ones.
 * Ties go to the bigger asset (lower market-cap rank).
 */
export function searchAssets(
  query: string,
  local: readonly PaletteAsset[],
  remote: readonly PaletteAsset[],
  limit: number,
): PaletteAsset[] {
  const scored = new Map<string, { asset: PaletteAsset; score: number }>();
  for (const asset of local) {
    const score = matchScore(asset, query);
    if (score !== null) scored.set(asset.id, { asset, score });
  }
  for (const asset of remote) {
    if (scored.has(asset.id)) continue;
    scored.set(asset.id, { asset, score: matchScore(asset, query) ?? REMOTE_ONLY });
  }
  return [...scored.values()]
    .sort(
      (a, b) =>
        a.score - b.score ||
        rankOf(a.asset) - rankOf(b.asset) ||
        a.asset.name.localeCompare(b.asset.name, "en", { sensitivity: "base" }),
    )
    .slice(0, limit)
    .map((entry) => entry.asset);
}

/* ---- items and groups ----------------------------------------------------- */

export type PagePaletteItem = {
  kind: "page";
  id: string;
  label: string;
  href: string;
  keywords: readonly string[];
  /** The keyboard shortcut for the same thing, shown beside it. */
  hotkey?: HotkeyId;
};
export type ActionPaletteItem = {
  kind: "action";
  id: "toggle-theme" | "show-shortcuts";
  label: string;
  keywords: readonly string[];
  hotkey?: HotkeyId;
};
export type AssetPaletteItem = {
  kind: "asset";
  id: string;
  asset: PaletteAsset;
  href: string;
};
export type PaletteItem = PagePaletteItem | ActionPaletteItem | AssetPaletteItem;

export type PaletteGroup = {
  id: "pages" | "actions" | "assets";
  label: string;
  items: PaletteItem[];
};

export const assetHref = (id: string) => `/coin/${encodeURIComponent(id)}`;

const PAGE_HOTKEY: Record<string, HotkeyId> = {
  "/": "go.home",
  "/markets": "go.markets",
  "/heatmap": "go.heatmap",
  "/watchlist": "go.watchlist",
  "/compare": "go.compare",
};

export function pageItems(links: readonly NavLink[]): PagePaletteItem[] {
  return [
    {
      kind: "page",
      id: "home",
      label: "Home",
      href: "/",
      keywords: ["start", "landing"],
      hotkey: PAGE_HOTKEY["/"],
    },
    ...links.map((link): PagePaletteItem => ({
      kind: "page",
      id: link.href,
      label: link.label,
      href: link.href,
      keywords: [],
      hotkey: PAGE_HOTKEY[link.href],
    })),
  ];
}

export function themeItem(theme: Theme): ActionPaletteItem {
  const next = theme === "dark" ? "light" : "dark";
  return {
    kind: "action",
    id: "toggle-theme",
    label: `Switch to ${next} theme`,
    keywords: ["theme", "dark", "light", "appearance", "mode", "colors"],
    hotkey: "theme",
  };
}

export function shortcutsItem(): ActionPaletteItem {
  return {
    kind: "action",
    id: "show-shortcuts",
    label: "Keyboard shortcuts",
    keywords: ["keys", "hotkeys", "help", "keyboard", "commands", "cheatsheet"],
    hotkey: "shortcuts",
  };
}

/** Whether a page or action answers to what was typed: a word of its label or keywords starts with it. */
export function commandMatches(item: PagePaletteItem | ActionPaletteItem, query: string) {
  return [item.label, ...item.keywords].some((text) =>
    text
      .toLowerCase()
      .split(/[\s._-]+/)
      .some((word) => word.startsWith(query)),
  );
}

export const TOP_ASSETS_SHOWN = 5;

/**
 * The palette's content for a query. With nothing typed it is a launchpad: every
 * page, the theme switch and a few top assets. Once something is typed it is the
 * pages and actions that answer to it, then the matching assets.
 */
export function buildGroups({
  query,
  theme,
  pages,
  assets,
  topAssets,
}: {
  query: string;
  theme: Theme;
  pages: readonly PagePaletteItem[];
  /** Ranked matches for `query` (see searchAssets). */
  assets: readonly PaletteAsset[];
  /** Shown when nothing is typed. */
  topAssets: readonly PaletteAsset[];
}): PaletteGroup[] {
  const actions = [themeItem(theme), shortcutsItem()];
  const typed = query !== "";

  const groups: PaletteGroup[] = [
    {
      id: "pages",
      label: "Pages",
      items: typed ? pages.filter((p) => commandMatches(p, query)) : [...pages],
    },
    {
      id: "actions",
      label: "Actions",
      items: typed ? actions.filter((a) => commandMatches(a, query)) : actions,
    },
    {
      id: "assets",
      label: typed ? "Assets" : "Top assets",
      items: (typed ? assets : topAssets.slice(0, TOP_ASSETS_SHOWN)).map(
        (asset): AssetPaletteItem => ({
          kind: "asset",
          id: asset.id,
          asset,
          href: assetHref(asset.id),
        }),
      ),
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

export const flattenGroups = (groups: readonly PaletteGroup[]) =>
  groups.flatMap((g) => g.items);

/** A stable key/DOM id fragment for an item. */
export const itemKey = (item: PaletteItem) => `${item.kind}-${item.id}`;
