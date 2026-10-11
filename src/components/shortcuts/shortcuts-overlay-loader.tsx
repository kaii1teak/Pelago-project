"use client";

import dynamic from "next/dynamic";
import { useLoadOnDemand } from "@/hooks/use-load-on-demand";
import { useHotkeysStore } from "@/stores/hotkeys";

// The overlay is opened with "?", from the footer or from the palette, never on page load:
// its code is fetched when the page is idle (or at once if it is asked for first).
const load = () =>
  import("./shortcuts-overlay").then((module) => module.ShortcutsOverlay);
const ShortcutsOverlay = dynamic(load, { ssr: false });

export function ShortcutsOverlayLoader() {
  const open = useHotkeysStore((s) => s.overlayOpen);
  return useLoadOnDemand(open, load) ? <ShortcutsOverlay /> : null;
}
