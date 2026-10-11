"use client";

import dynamic from "next/dynamic";
import { useLoadOnDemand } from "@/hooks/use-load-on-demand";
import { usePaletteStore } from "@/stores/palette";

// The palette (a Radix dialog and the search around it) is in no page's first paint and is
// needed only when someone presses Ctrl+K, so its code stays out of the JavaScript every page
// downloads up front. It is fetched when the page is idle, or at once if asked for first.
const load = () => import("./command-palette").then((module) => module.CommandPalette);
const CommandPalette = dynamic(load, { ssr: false });

export function CommandPaletteLoader() {
  const open = usePaletteStore((s) => s.open);
  return useLoadOnDemand(open, load) ? <CommandPalette /> : null;
}
