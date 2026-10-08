"use client";

import { motion, useIsPresent, type HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";

/**
 * A list item that animates out (use inside <AnimatePresence>). While it is leaving it is
 * `inert`: still on screen for its last moments, but nothing in it can be focused or
 * clicked, and focus logic can tell it is as good as gone (`el.closest("[inert]")`).
 */
export const PresenceLi = forwardRef<HTMLLIElement, HTMLMotionProps<"li">>(
  function PresenceLi(props, ref) {
    const present = useIsPresent();
    return <motion.li ref={ref} inert={!present} {...props} />;
  },
);
