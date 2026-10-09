import { useEffect, useRef } from "react";

/**
 * Flashes an element when `value` goes up (green) or down (red), by setting `data-flash` on
 * it; the animation is in globals.css. The element is an HTML one (a price) or a layer of an
 * SVG (a heatmap cell). It is set on the element directly, not through React state, so a
 * flash costs no render. "a" and "b" alternate so that two changes in a
 * row restart the animation (a new animation name restarts it, with no forced reflow).
 */
export function useFlash<T extends HTMLElement | SVGElement>(
  value: number | null | undefined,
) {
  const ref = useRef<T>(null);
  const before = useRef(value);
  const flip = useRef(false);

  useEffect(() => {
    const previous = before.current;
    before.current = value;
    const element = ref.current;
    if (!element || previous == null || value == null || value === previous) return;
    flip.current = !flip.current;
    element.dataset.flash = `${value > previous ? "up" : "down"}-${flip.current ? "a" : "b"}`;
  }, [value]);

  return ref;
}
