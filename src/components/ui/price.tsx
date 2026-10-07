import { formatCompactUsd, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

/** USD value in the mono/tabular style used for every figure in the app. */
export function Price({
  value,
  compact = false,
  className,
}: {
  value: number | null | undefined;
  /** $2.41T instead of $2,410,000,000,000. For market cap and volume. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("num", className)}>
      {compact ? formatCompactUsd(value) : formatUsd(value)}
    </span>
  );
}
