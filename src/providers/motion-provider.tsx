"use client";

import { MotionConfig } from "motion/react";

/**
 * "user" makes every `motion` component honor prefers-reduced-motion: transform
 * and layout animations are dropped, opacity/color changes stay. (The CSS
 * animations are covered by the media query in globals.css.)
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
