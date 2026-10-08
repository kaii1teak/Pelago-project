"use client";

import { useRouter } from "next/navigation";
import { useHotkey } from "@/hooks/use-hotkey";
import { useTheme } from "@/hooks/use-theme";
import { moveRow, openRow, toggleRowWatch } from "@/lib/hotkeys/rows";
import { usePaletteStore } from "@/stores/palette";
import { useHotkeysStore } from "@/stores/hotkeys";

/** A field a page marks as "its" search: "/" jumps there. */
const SEARCH_FIELD = "[data-hotkey-search]";

function focusSearch() {
  const field = [...document.querySelectorAll<HTMLInputElement>(SEARCH_FIELD)].find(
    (el) => el.getBoundingClientRect().width > 0,
  );
  if (!field) return false;
  field.focus();
  field.select();
  return true;
}

/**
 * The shortcuts that work on every page, wired to what they do. Mounted once (by
 * <HotkeysProvider>); what a shortcut IS lives in lib/hotkeys/catalog.ts. The ones that
 * belong to a single page (the chart's 1-4, c) are registered by that page.
 */
export function GlobalHotkeys() {
  const router = useRouter();
  const { toggleTheme } = useTheme();

  useHotkey("palette", () => usePaletteStore.getState().toggle());
  useHotkey("shortcuts", () => useHotkeysStore.getState().openOverlay());
  // The page's own search box if it has one, otherwise the palette (which searches everything).
  useHotkey("search", () => {
    if (!focusSearch()) usePaletteStore.getState().setOpen(true);
  });
  useHotkey("theme", () => toggleTheme());

  useHotkey("go.home", () => router.push("/"));
  useHotkey("go.markets", () => router.push("/markets"));
  useHotkey("go.watchlist", () => router.push("/watchlist"));
  useHotkey("go.compare", () => router.push("/compare"));

  useHotkey("list.next", () => moveRow(1));
  useHotkey("list.prev", () => moveRow(-1));
  useHotkey("list.open", () => openRow());
  useHotkey("list.watch", () => toggleRowWatch());

  return null;
}
