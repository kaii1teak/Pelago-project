"use client";

import { useSyncExternalStore } from "react";
import type { Viewer } from "@/components/coin/chart-format";

const noop = () => () => {};

/** What the server writes times in: it can't know better, and every render of it must agree. */
const SERVER: Viewer = { locale: "en-US", timeZone: "UTC" };

let browser: Viewer | undefined;
function viewerOfBrowser(): Viewer {
  if (!browser) {
    const { locale, timeZone } = new Intl.DateTimeFormat().resolvedOptions();
    browser = { locale, timeZone };
  }
  return browser;
}

/**
 * The viewer's locale and time zone, for text that is in the server's HTML as well as the
 * browser's. The server (and the browser's first, hydrating render) writes UTC; right after
 * hydration the viewer's own clock replaces it. Writing the viewer's clock straight away
 * would differ from the server's text and make React throw the server HTML away (the error
 * #418 the deployed coin page showed: Vercel's server is on UTC, visitors are not).
 */
export function useViewerTime(): Viewer {
  return useSyncExternalStore(noop, viewerOfBrowser, () => SERVER);
}
