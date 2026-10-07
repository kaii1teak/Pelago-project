"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  marketsStateToSearch,
  parseMarketsState,
  type MarketsState,
} from "@/lib/markets-url";

/**
 * The Markets view's state (search, sort, filters, page) lives in the URL, so a
 * link reproduces the exact view and Back/Forward work.
 *
 * Updates go through the native History API, which Next integrates with
 * `useSearchParams`. That makes a keystroke or a sort click an instant,
 * client-only URL change. `router.replace` would ask the server for a new
 * page payload every time.
 *
 * `replace` for refinements (typing, sorting) so they don't flood history;
 * `push` for navigation-like changes (page, category) so Back returns to them.
 */
export function useMarketsUrlState() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const state = useMemo(() => parseMarketsState(searchParams), [searchParams]);

  const update = useCallback(
    (patch: Partial<MarketsState>, mode: "replace" | "push" = "replace") => {
      // Read the live URL, not the closed-over `state`: two updates in the same
      // tick (e.g. set view, then set sort) must build on each other.
      const current = parseMarketsState(new URLSearchParams(window.location.search));
      const search = marketsStateToSearch({ ...current, ...patch });
      const url = search ? `${pathname}?${search}` : pathname;
      if (url === `${window.location.pathname}${window.location.search}`) return;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [pathname],
  );

  return { state, update };
}
