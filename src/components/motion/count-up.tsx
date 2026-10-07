"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import {
  formatCompactUsd,
  formatInteger,
  formatPercent,
  formatPlainPercent,
  formatUsd,
} from "@/lib/format";
import { DURATION, EASE_STANDARD } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Chosen by name, not passed as a function: Server Components can't send
// functions to Client Components, and this needs to be usable from both.
const FORMATTERS = {
  usd: formatUsd,
  compactUsd: formatCompactUsd,
  integer: formatInteger,
  percent: (v: number) => formatPercent(v, 2),
  plainPercent: (v: number) => formatPlainPercent(v, 1),
} as const;

export type CountUpFormat = keyof typeof FORMATTERS;

// Update the existing text node in place instead of textContent: that keeps
// React's reference to it valid.
function write(el: HTMLElement, text: string) {
  if (el.firstChild) el.firstChild.nodeValue = text;
  else el.textContent = text;
}

/**
 * Number that counts up the first time it scrolls into view; later live
 * updates swap in instantly. The server renders the final value (so crawlers,
 * screen readers and no-JS users see real numbers), and CSS holds it back
 * (`data-count="idle"`, see globals.css) until JS can start the count, which
 * avoids a final -> 0 -> count flash on hydration. Screen readers get the final
 * value too (the animated text is hidden from them so they aren't read 60 digits).
 */
export function CountUp({
  value,
  format,
  duration = DURATION.count,
  className,
}: {
  value: number;
  format: CountUpFormat;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  /** The number currently on screen; null until the first animation has run. */
  const shown = useRef<number | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduceMotion = useReducedMotion();
  const fmt = FORMATTERS[format];

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;

    const first = shown.current === null;
    const from = shown.current ?? 0;

    // Un-hide only after the text is set to its starting point, so the user
    // never sees the server's final number flash before the count begins.
    const reveal = () => {
      el.dataset.count = "ready";
    };

    // Only the first reveal counts up. Live refreshes snap to the new value:
    // numbers people are reading shouldn't keep moving for style every minute.
    if (reduceMotion || !first || from === value) {
      write(el, fmt(value));
      shown.current = value;
      reveal();
      return;
    }

    write(el, fmt(from));
    reveal();

    const controls = animate(from, value, {
      duration,
      ease: EASE_STANDARD,
      onUpdate: (v) => {
        shown.current = v;
        write(el, fmt(v));
      },
      onComplete: () => {
        shown.current = value;
        write(el, fmt(value));
      },
    });
    return () => controls.stop();
  }, [inView, value, reduceMotion, fmt, duration]);

  return (
    <span className={cn("num", className)}>
      <span ref={ref} aria-hidden="true" data-count="idle">
        {fmt(value)}
      </span>
      <span className="sr-only">{fmt(value)}</span>
    </span>
  );
}
