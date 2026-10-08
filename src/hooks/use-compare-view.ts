"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { CompareView } from "@/lib/compare";
import { viewFrom, withView } from "@/lib/compare-url";

/**
 * What the comparison plots (percent change, or prices) lives in the URL
 * (?view=price) so a link reproduces it. Written with the History API like the
 * range, which Next picks up through useSearchParams without a server round trip.
 */
export function useCompareView() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const setView = useCallback(
    (view: CompareView) => {
      // The live URL, not a stale closure, so quick updates compose.
      const url = `${pathname}${withView(window.location.search, view)}`;
      if (url !== `${window.location.pathname}${window.location.search}`) {
        window.history.replaceState(null, "", url);
      }
    },
    [pathname],
  );

  return { view: viewFrom(searchParams), setView };
}
