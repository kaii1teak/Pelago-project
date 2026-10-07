import { useId } from "react";
import { type FanOptions, buildLineFan } from "@/lib/line-fan";
import { cn } from "@/lib/utils";

/**
 * Static decorative line motif (see lib/line-fan). A plain server-rendered SVG:
 * no JavaScript, no animation, so it is in the very first paint and costs
 * nothing at runtime. It strokes with `currentColor`, so it follows the theme
 * on its own; the caller sets the size and position.
 *
 * Decorative only: hidden from assistive tech and never interactive.
 */
export function LineFan({ fan, className }: { fan: FanOptions; className?: string }) {
  const { sides, rays } = buildLineFan(fan);
  // Several fans can share a page; each needs its own gradient id.
  const fade = `fan-fade-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

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
      {rays.length > 0 && (
        <defs>
          {/* Opaque at the point, gone at the top of the rays. */}
          <linearGradient
            id={fade}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={fan.pointY}
            x2="0"
            y2={fan.rayTop}
          >
            <stop offset="0" stopColor="currentColor" stopOpacity="1" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      <g>
        {sides.map((line, i) => (
          <path key={i} d={line.d} strokeOpacity={line.opacity} />
        ))}
      </g>
      {/* Dimmer on narrow screens, where the copy spans the full width. */}
      <g className="opacity-50 md:opacity-100">
        {rays.map((line, i) => (
          <path
            key={i}
            d={line.d}
            stroke={`url(#${fade})`}
            strokeOpacity={line.opacity}
          />
        ))}
      </g>
    </svg>
  );
}
