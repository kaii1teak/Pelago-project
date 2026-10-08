import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { TweenNumber } from "@/components/motion/tween-number";
import { directionOf, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;
const LABELS = { up: "up", down: "down", flat: "unchanged" } as const;

/**
 * Signed percentage change: success/critical text on a 12% tint of the same
 * color. Direction is carried by the sign, an arrow and a screen-reader word,
 * never by color alone. This is the only place green and red appear in the
 * data UI.
 */
export function PercentChange({
  value,
  digits = 2,
  showIcon = true,
  tweenKey,
  className,
}: {
  value: number | null | undefined;
  digits?: number;
  showIcon?: boolean;
  /** Count from the old value to the new one whenever this changes (a new range, say). */
  tweenKey?: string | number;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <span className={cn("num text-muted", className)}>
        —<span className="sr-only">no data</span>
      </span>
    );
  }

  const direction = directionOf(value, digits);
  const Icon = ICONS[direction];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 num",
        direction === "up" && "bg-success-tint text-success",
        direction === "down" && "bg-critical-tint text-critical",
        direction === "flat" && "text-secondary",
        className,
      )}
    >
      {showIcon && <Icon className="size-3 shrink-0" aria-hidden="true" />}
      <span>
        {tweenKey === undefined ? (
          formatPercent(value, digits)
        ) : (
          <TweenNumber
            value={value}
            format={(n) => formatPercent(n, digits)}
            tweenKey={tweenKey}
          />
        )}
      </span>
      <span className="sr-only">{LABELS[direction]}</span>
    </span>
  );
}
