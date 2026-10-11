"use client";

import { useEffect, useState } from "react";

/** How long after the page has mounted the code is fetched ahead of time. */
export const PRELOAD_DELAY_MS = 2500;

/**
 * For a part of the page that is only used when asked for (a dialog): says when to load its
 * code. That is the moment it is first wanted, or, so the first use is not a wait, a couple
 * of seconds after the page has loaded and the browser has nothing better to do. Waiting
 * those seconds keeps the download out of the page's first moments, when everything the
 * visitor can see is still arriving (and what a speed test counts against the first paint).
 * Either way it stays loaded, so closing it can still animate out.
 *
 * `preload` must be the same import() the lazy component loads with: the bundler then
 * downloads that code once, whoever asks first.
 */
export function useLoadOnDemand(
  wanted: boolean,
  preload: () => Promise<unknown>,
): boolean {
  const [loaded, setLoaded] = useState(false);
  // Adjusting state while rendering, not in an effect: no frame without the dialog it asks for.
  if (wanted && !loaded) setLoaded(true);

  useEffect(() => {
    const load = () => void preload();
    let idle: number | undefined;
    const timer = window.setTimeout(() => {
      if (typeof requestIdleCallback === "function") {
        idle = requestIdleCallback(load, { timeout: 3000 });
      } else {
        load();
      }
    }, PRELOAD_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  }, [preload]);

  return loaded;
}
