/**
 * Motion constants for the `motion` library, which takes numbers rather than
 * CSS variables. They mirror --ease-standard and the 0.15/0.25/0.3s durations
 * in globals.css; change them together.
 */
export const EASE_STANDARD = [0.4, 0, 0.2, 1] as const;

export const DURATION = {
  /** Hover/press feedback. */
  fast: 0.15,
  /** Entrances, indicators. */
  base: 0.25,
  /** Scroll reveals. */
  slow: 0.3,
  /** First-view number count-up. */
  count: 1.2,
} as const;
