"use client";

import { motion, useIsPresent, type HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";
import { DURATION, EASE_STANDARD, entering } from "@/lib/motion";

/**
 * The enter and exit of a small popup (a list of choices under an input, a color grid):
 * it fades and settles a few pixels as it opens, and fades out quickly as it closes.
 * Render it inside <AnimatePresence>. While it leaves it is `inert`, so it can't be
 * focused or clicked in its last moments.
 */
export const MotionPopover = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  function MotionPopover(props, ref) {
    const present = useIsPresent();
    return (
      <motion.div
        ref={ref}
        inert={!present}
        initial={entering({ opacity: 0, y: -4 })}
        animate={{ opacity: 1, y: 0 }}
        exit={{
          opacity: 0,
          transition: { duration: DURATION.fast, ease: EASE_STANDARD },
        }}
        transition={{ duration: DURATION.base, ease: EASE_STANDARD }}
        {...props}
      />
    );
  },
);
