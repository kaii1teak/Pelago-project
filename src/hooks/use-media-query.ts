"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a media query currently matches. The server (and the hydration pass)
 * report `false`, so layout must come from CSS; use this only to switch
 * *behavior* (e.g. whether scroll position drives state), never markup.
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
