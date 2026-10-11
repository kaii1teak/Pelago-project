import { useViewerTime } from "@/hooks/use-viewer-time";
import { formatUsd } from "@/lib/format";
import type { ChartMode, ChartRange } from "@/lib/chart";
import { formatChartTime } from "./chart-format";
import type { CrosshairInfo } from "./chart-canvas";

function Field({ label, value }: { label: string; value: number | undefined }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-muted">{label}</span>
      <span className="text-primary">{formatUsd(value)}</span>
    </span>
  );
}

/**
 * A flat readout pinned to the chart's corner: the value under the crosshair,
 * or the latest value when the pointer is away. Purely visual (the chart
 * summary below it is what screen readers get).
 */
export function ChartLegend({
  info,
  mode,
  range,
}: {
  info: CrosshairInfo | null;
  mode: ChartMode;
  range: ChartRange;
}) {
  const viewer = useViewerTime();
  if (!info) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-3 left-3 z-10 flex flex-col gap-1 border border-primary bg-primary px-3 py-2 num text-mono-sm"
    >
      <span className="text-muted">{formatChartTime(range, info.time, viewer)}</span>
      {mode === "line" ? (
        <span className="text-mono-md text-primary">{formatUsd(info.value)}</span>
      ) : (
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <Field label="O" value={info.open} />
          <Field label="H" value={info.high} />
          <Field label="L" value={info.low} />
          <Field label="C" value={info.close} />
        </span>
      )}
    </div>
  );
}
