import { type FanOptions, buildLineFan } from "@/lib/line-fan";
import { cn } from "@/lib/utils";

/**
 * Static decorative line motif (see lib/line-fan). A plain server-rendered SVG:
 * no JavaScript, no animation, so it is in the very first paint and costs
 * nothing at runtime. It strokes with `currentColor`, so it follows the theme
 * on its own (light ink on dark, dark ink on light); the caller sets the size
 * and position.
 *
 * Decorative only: hidden from assistive tech and never interactive.
 */
export function LineFan({ fan, className }: { fan: FanOptions; className?: string }) {
  const { sides, rising } = buildLineFan(fan);

  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden="true"
      focusable="false"
      className={cn("line-fan text-primary", className)}
    >
      {[...sides, ...rising].map((line, i) => (
        <path key={i} d={line.d} strokeOpacity={line.opacity} />
      ))}
    </svg>
  );
}
