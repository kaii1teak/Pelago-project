"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { PAGE_TRANSITION, ViewTransition } from "@/components/motion/view-transition";
import { DURATION, EASE_STANDARD } from "@/lib/motion";
import { isFirstPage, markHydrated } from "@/lib/session-state";

const canViewTransition = () =>
  typeof document !== "undefined" && "startViewTransition" in document;

/**
 * Re-mounts on every navigation (that's what a template does), so each route
 * change is a page leaving and a page arriving.
 *
 * Browsers with the View Transitions API animate that themselves (the
 * <ViewTransition> below: a quick crossfade, or a slide when the link says which
 * way it goes; see "View transitions" in globals.css). The others get the plain
 * fade-and-rise this file always had, done by `motion`. The initial page load
 * animates nothing: the content is already in the server HTML and must not flash
 * invisible before hydrating.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const isInitialLoad = isFirstPage();
  const fadeIn = !isInitialLoad && !canViewTransition();

  useEffect(() => {
    markHydrated();
  }, []);

  return (
    <ViewTransition enter={PAGE_TRANSITION} exit={PAGE_TRANSITION} default="none">
      <motion.div
        initial={fadeIn ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: EASE_STANDARD }}
      >
        {children}
      </motion.div>
    </ViewTransition>
  );
}
