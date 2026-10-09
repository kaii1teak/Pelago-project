"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  heatmapStateToSearch,
  parseHeatmapState,
  type HeatmapState,
} from "@/lib/heatmap-url";

/**
 * The heatmap's choices (period, size, how many, category) live in the URL, so a link
 * reproduces the picture and Back/Forward work. Same approach as the Markets view: updates
 * go through the History API, which Next integrates with `useSearchParams`, so changing a
 * choice is an instant client-side URL change that asks the server for nothing.
 *
 * `replace` for refinements (period, size, count) so they don't flood history; `push` for a
 * change of subject (category), so Back returns to the previous category.
 */
export function useHeatmapUrlState() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const state = useMemo(() => parseHeatmapState(searchParams), [searchParams]);

  const update = useCallback(
    (patch: Partial<HeatmapState>, mode: "replace" | "push" = "replace") => {
      // Read the live URL, not the closed-over state: two updates in one tick build on each other.
      const current = parseHeatmapState(new URLSearchParams(window.location.search));
      const search = heatmapStateToSearch({ ...current, ...patch });
      const url = search ? `${pathname}?${search}` : pathname;
      if (url === `${window.location.pathname}${window.location.search}`) return;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [pathname],
  );

  return { state, update };
}
