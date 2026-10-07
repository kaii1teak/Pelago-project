"use client";

import { memo, useMemo } from "react";
import { buildSparklinePath } from "@/lib/series";
import { cn } from "@/lib/utils";

/**
 * Tiny inline-SVG trend line in a single neutral color (text-secondary): the
 * shape tells the story and green/red are reserved for the % change beside it.
 * It stretches to its container (give it a height) and the stroke stays 1px at
 * any size. Memoized: a table of these re-renders on every live refresh, and
 * most series don't change between refreshes.
 *
 * Decorative by design (aria-hidden): the adjacent % change carries the meaning.
 */
export const Sparkline = memo(function Sparkline({
  data,
  className,
}: {
  data: readonly number[];
  className?: string;
}) {
  const path = useMemo(() => buildSparklinePath(data), [data]);

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-8 w-full text-secondary", className)}
    >
      {path ? (
        <path
          d={path.line}
          fill="none"
          stroke="currentColor"
          className="stroke-1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        // Keep the box (no layout shift) and show a dashed baseline instead of nothing.
        <line
          x1="0"
          x2="100"
          y1="16"
          y2="16"
          stroke="currentColor"
          className="stroke-1 text-muted"
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
});
