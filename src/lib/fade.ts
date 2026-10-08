import { DURATION } from "@/lib/motion";

/**
 * Fades an element from transparent to opaque with the Web Animations API, for things
 * that are redrawn in place (a chart canvas) and so can't be remounted with a CSS
 * class. Opacity only, so it is fine under reduced motion too. A no-op where the API is
 * missing (jsdom).
 */
export function fadeIn(element: HTMLElement, duration: number = DURATION.base) {
  if (typeof element.animate !== "function") return;
  element.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: duration * 1000,
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  });
}
