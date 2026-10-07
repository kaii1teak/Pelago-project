import { formatChartTime } from "@/components/coin/chart-format";
import type { ChartRange } from "@/lib/chart";
import { formatPercent } from "@/lib/format";
import { Swatch } from "./asset-chips";
import type { CompareCrosshair } from "./compare-canvas";

export type LegendEntry = { id: string; slot: number; symbol: string };

/**
 * A flat readout pinned to the chart's corner while the pointer is on it: the
 * time, and each asset's percent change there. Purely visual: the chips and the
 * table are what screen readers get.
 */
export function CompareLegend({
  info,
  entries,
  range,
}: {
  info: CompareCrosshair | null;
  entries: readonly LegendEntry[];
  range: ChartRange;
}) {
  if (!info) return null;
  const rows = entries.filter((e) => info.values[e.id] !== undefined);
  if (rows.length === 0) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-3 left-3 z-10 flex min-w-36 flex-col gap-1.5 border border-primary bg-primary px-3 py-2 num text-mono-sm"
    >
      <span className="text-muted">{formatChartTime(range, info.time)}</span>
      {rows.map((entry) => (
        <span key={entry.id} className="flex items-center gap-2">
          <Swatch slot={entry.slot} className="h-3 w-1 shrink-0" />
          <span className="text-muted">{entry.symbol}</span>
          <span className="ml-auto text-primary">
            {formatPercent(info.values[entry.id])}
          </span>
        </span>
      ))}
    </div>
  );
}
