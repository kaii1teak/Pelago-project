import { formatUsd } from "@/lib/format";
import { clamp } from "@/lib/utils";

/**
 * Where the price sits between the 24h low and high: a hairline with a marker.
 * Monochrome on purpose (it's position, not good/bad).
 */
export function RangeBar({
  low,
  high,
  value,
}: {
  low: number | null;
  high: number | null;
  value: number | null;
}) {
  if (low == null || high == null || value == null || high <= low) return null;
  const percent = clamp(((value - low) / (high - low)) * 100, 0, 100);

  return (
    <div
      role="img"
      aria-label={`Current price ${formatUsd(value)} is ${Math.round(percent)} percent of the way from the 24 hour low ${formatUsd(low)} to the high ${formatUsd(high)}`}
      className="relative h-4 w-full"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 border-t border-strong"
      />
      <div
        aria-hidden="true"
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 bg-inverse"
        style={{ left: `${percent}%` }}
      />
    </div>
  );
}
