"use client";

import { useEffect, type RefObject } from "react";

/**
 * Tells CSS when a `position: sticky` element is stuck, by setting `data-stuck="true"` on it
 * (and removing it again). CSS can't see that on its own in every browser, and a sticky
 * element is "stuck" exactly when it would have been higher up: its top has reached the
 * `top` it sticks at.
 *
 * It sets the attribute on the element directly instead of through React state, so being
 * stuck costs no render, and it only touches the DOM when the answer changes.
 */
export function useStuck(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;

    const check = () => {
      frame = 0;
      const stickyTop = Number.parseFloat(getComputedStyle(element).top);
      if (Number.isNaN(stickyTop)) return;
      const stuck = element.getBoundingClientRect().top <= stickyTop + 0.5;
      if (stuck) element.dataset.stuck = "true";
      else delete element.dataset.stuck;
    };
    // At most one look per frame, however many scroll events come.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };

    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref]);
}
