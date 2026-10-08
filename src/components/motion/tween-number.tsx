"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { DURATION, EASE_STANDARD } from "@/lib/motion";

/** How long after the key changes a new value still counts as the answer to that change. */
const ARMED_MS = 5000;

/**
 * A figure that counts from its old value to its new one when `tweenKey` changes (the
 * range was switched, say), and otherwise just takes the new value: live refreshes
 * must not make numbers dance every few seconds. The new value often arrives a moment
 * AFTER the key changes (the data has to load), so a key change arms the count and the
 * next change of value, within a few seconds, is the one that plays it.
 *
 * The text is written straight to the element while it counts (60 updates a second
 * through React would be a render each), and the server and the first client render
 * agree on the plain final text. Under reduced motion it never counts.
 */
export function TweenNumber({
  value,
  format,
  tweenKey,
}: {
  value: number | null | undefined;
  format: (value: number | null | undefined) => string;
  tweenKey: string | number;
}) {
  const element = useRef<HTMLSpanElement>(null);
  const [initial] = useState(() => format(value));
  const shown = useRef(value); // the number on screen right now
  const lastKey = useRef(tweenKey);
  const armedUntil = useRef(0);
  const latestFormat = useRef(format);
  const reduce = useReducedMotion();

  useEffect(() => {
    latestFormat.current = format;
  });

  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const write = (n: number | null | undefined) => {
      shown.current = n;
      el.textContent = latestFormat.current(n);
    };

    if (lastKey.current !== tweenKey) {
      lastKey.current = tweenKey;
      armedUntil.current = performance.now() + ARMED_MS;
    }
    const from = shown.current;
    if (
      performance.now() >= armedUntil.current ||
      from === value ||
      reduce ||
      typeof from !== "number" ||
      typeof value !== "number" ||
      !Number.isFinite(from) ||
      !Number.isFinite(value)
    ) {
      write(value);
      return;
    }
    armedUntil.current = 0; // one count per change of key

    const controls = animate(from, value, {
      duration: DURATION.slow,
      ease: EASE_STANDARD,
      onUpdate: write,
      onComplete: () => write(value),
    });
    return () => controls.stop();
  }, [value, tweenKey, reduce]);

  return <span ref={element}>{initial}</span>;
}
