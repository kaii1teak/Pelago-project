import { MotionGlobalConfig } from "motion/react";

/**
 * Motion constants for the `motion` library, which takes seconds rather than CSS
 * variables. They mirror --duration-* and --ease-* in globals.css (120 / 200 / 300 /
 * 500 ms); change them together. A test fails when the two drift apart.
 */
export const EASE_STANDARD = [0.4, 0, 0.2, 1] as const;

export const DURATION = {
  /** Hover and press feedback. */
  fast: 0.12,
  /** Most state changes: indicators, overlays, a list item entering. */
  base: 0.2,
  /** Entrances and scroll reveals. */
  slow: 0.3,
  /** Large moves. */
  slower: 0.5,
  /**
   * A figure counting up on first view. Data, not UI chrome, so it is allowed to
   * be longer than the scale above.
   */
  count: 1.2,
} as const;

/** The `motion` counterpart of --ease-spring: overshoots slightly, then settles. */
export const SPRING = { type: "spring", stiffness: 420, damping: 30, mass: 1 } as const;

/**
 * The state something mounts in before it animates to its resting state. With animations
 * switched off globally (MotionGlobalConfig.skipAnimations, which tests do) it mounts
 * directly in the resting state, so it is never caught half-visible.
 */
export const entering = <State extends object>(from: State): State | false =>
  MotionGlobalConfig.skipAnimations ? false : from;
