import { cn } from "@/lib/utils";

/** The picture's place while its data loads: the same frame, so nothing moves when it lands. */
export function HeatmapSkeleton({
  density = "full",
  tall,
  className,
}: {
  density?: "full" | "compact";
  tall?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the heatmap"
      className={cn("heat-box", className)}
    >
      <div
        data-density={density}
        style={tall ? ({ "--heat-tall": tall } as React.CSSProperties) : undefined}
        className="heat-frame animate-skeleton bg-secondary"
      />
    </div>
  );
}
