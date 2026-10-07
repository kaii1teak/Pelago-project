"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { DURATION, EASE_STANDARD } from "@/lib/motion";

const VIEWPORT = { once: true, margin: "0px 0px -80px 0px" } as const;

/**
 * Fade/rise into view once as it scrolls on screen. Use for below-the-fold
 * content only: the hidden start state is in the server HTML, so anything
 * above the fold would flash in late and hurt LCP.
 * Reduced-motion users get the fade without the movement (see MotionProvider).
 */
export function Reveal({
  delay = 0,
  y = 16,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: DURATION.slow, delay, ease: EASE_STANDARD }}
      {...props}
    />
  );
}

/** Parent that staggers its <RevealItem> children as the group enters view. */
export function RevealGroup({
  stagger = 0.06,
  ...props
}: HTMLMotionProps<"div"> & { stagger?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      {...props}
    />
  );
}

export function RevealItem({
  y = 12,
  ...props
}: HTMLMotionProps<"div"> & { y?: number }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: DURATION.slow, ease: EASE_STANDARD },
        },
      }}
      {...props}
    />
  );
}
