import { TweenNumber } from "@/components/motion/tween-number";
import { formatCompactUsd, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

/** USD value in the mono/tabular style used for every figure in the app. */
export function Price({
  value,
  compact = false,
  tweenKey,
  className,
}: {
  value: number | null | undefined;
  /** $2.41T instead of $2,410,000,000,000. For market cap and volume. */
  compact?: boolean;
  /** Count from the old value to the new one whenever this changes (a new range, say). */
  tweenKey?: string | number;
  className?: string;
}) {
  const format = compact ? formatCompactUsd : formatUsd;
  return (
    <span className={cn("num", className)}>
      {tweenKey === undefined ? (
        format(value)
      ) : (
        <TweenNumber value={value} format={format} tweenKey={tweenKey} />
      )}
    </span>
  );
}
