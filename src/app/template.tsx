"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { DURATION, EASE_STANDARD } from "@/lib/motion";

// Module scope on purpose: it survives route changes, so only the *first* render
// of the session is treated as the initial load. (On the server effects never
// run, so SSR always renders the visible, un-animated state.)
let hasHydrated = false;

/**
 * Re-mounts on every navigation (that's what a template does), so each page
 * eases in. The initial page load skips the animation entirely: the content is
 * already in the server HTML and must not flash invisible before hydrating.
 *
 * Enter-only by design. Exit animations in the App Router need hacks around
 * the router's context and are a common source of stale-page bugs.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const isInitialLoad = !hasHydrated;

  useEffect(() => {
    hasHydrated = true;
  }, []);

  return (
    <motion.div
      initial={isInitialLoad ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_STANDARD }}
    >
      {children}
    </motion.div>
  );
}
