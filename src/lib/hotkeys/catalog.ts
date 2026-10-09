/**
 * Every keyboard shortcut in the app, in one list. The dispatcher, the shortcuts overlay,
 * the command palette and the tooltips all read it, so a key is written down once and
 * what is shown can never differ from what works.
 *
 * `keys`: chords separated by spaces. A chord is a key, optionally with `mod+` (Cmd on
 * Apple devices, Ctrl elsewhere). "g h" is a sequence: press g, then h.
 */
export type HotkeyGroup = "general" | "go" | "list" | "asset";

export type HotkeyDef = {
  id: string;
  keys: string;
  group: HotkeyGroup;
  description: string;
  /** Works even while the shortcuts are switched off (WCAG 2.1.4 is about single characters). */
  always?: boolean;
  /** Works while typing in a field (a chord with a modifier can't be mistaken for text). */
  allowInInput?: boolean;
  /** Works while a dialog is open. */
  inDialog?: boolean;
  /** Fires again while the key is held down (moving through rows). */
  repeat?: boolean;
};

export const HOTKEYS = [
  {
    id: "palette",
    keys: "mod+k",
    group: "general",
    description: "Search assets and pages",
    always: true,
    allowInInput: true,
    inDialog: true,
  },
  {
    id: "shortcuts",
    keys: "?",
    group: "general",
    description: "Show keyboard shortcuts",
  },
  { id: "search", keys: "/", group: "general", description: "Focus the search field" },
  {
    id: "theme",
    keys: "t",
    group: "general",
    description: "Switch light and dark theme",
  },

  { id: "go.home", keys: "g h", group: "go", description: "Go to Home" },
  { id: "go.markets", keys: "g m", group: "go", description: "Go to Markets" },
  { id: "go.heatmap", keys: "g p", group: "go", description: "Go to Heatmap" },
  { id: "go.watchlist", keys: "g w", group: "go", description: "Go to Watchlist" },
  { id: "go.compare", keys: "g c", group: "go", description: "Go to Compare" },

  { id: "list.next", keys: "j", group: "list", description: "Next row", repeat: true },
  {
    id: "list.prev",
    keys: "k",
    group: "list",
    description: "Previous row",
    repeat: true,
  },
  { id: "list.open", keys: "Enter", group: "list", description: "Open the selected row" },
  {
    id: "list.watch",
    keys: "w",
    group: "list",
    description: "Add or remove the selected row from your watchlist",
  },

  { id: "chart.24h", keys: "1", group: "asset", description: "Chart: 24 hours" },
  { id: "chart.7d", keys: "2", group: "asset", description: "Chart: 7 days" },
  { id: "chart.30d", keys: "3", group: "asset", description: "Chart: 30 days" },
  { id: "chart.1y", keys: "4", group: "asset", description: "Chart: 1 year" },
  { id: "chart.mode", keys: "c", group: "asset", description: "Switch line and candles" },
  {
    id: "asset.compare",
    keys: "a",
    group: "asset",
    description: "Compare with other assets",
  },
] as const satisfies readonly HotkeyDef[];

export type HotkeyId = (typeof HOTKEYS)[number]["id"];

export const GROUP_LABEL: Record<HotkeyGroup, string> = {
  general: "General",
  go: "Go to",
  list: "Markets and watchlist",
  asset: "Asset page",
};

/** Where a group's shortcuts apply, shown under its name in the overlay. */
export const GROUP_NOTE: Partial<Record<HotkeyGroup, string>> = {
  go: "Press g, then the next key.",
  list: "Move through the rows, then act on the selected one.",
  asset: "On an asset's page.",
};

export const GROUPS = Object.keys(GROUP_LABEL) as HotkeyGroup[];

export const hotkeyDef = (id: HotkeyId): HotkeyDef =>
  HOTKEYS.find((h) => h.id === id) as HotkeyDef;
