"use client";

import { Grid2x2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LiveBadge } from "@/components/ui/live-badge";
import { useHeatmapUrlState } from "@/hooks/use-heatmap-url-state";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useHeatmap } from "@/lib/api/hooks";
import { categoryLabel } from "@/lib/categories";
import { tallFor } from "@/lib/heatmap";
import { defaultUniverse } from "@/lib/heatmap-url";
import { HeatmapControls } from "./heatmap-controls";
import { HeatmapLegend } from "./heatmap-legend";
import { HeatmapSkeleton } from "./heatmap-skeleton";
import { Treemap } from "./treemap";

/** Below this the picture is a tall one (the same width the CSS switches layout at). */
const PHONE = "(max-width: 42rem)";

export function HeatmapView() {
  const { state, update } = useHeatmapUrlState();
  const narrow = useMediaQuery(PHONE);
  const top = state.top ?? defaultUniverse(narrow);
  const { data, error, isPending, isFetching, isPlaceholderData, refetch } = useHeatmap(
    state.category,
  );
  const tall = tallFor(top);

  return (
    <div className="space-y-8">
      <HeatmapControls
        period={state.period}
        top={top}
        size={state.size}
        category={state.category}
        onPeriodChange={(period) => update({ period })}
        onTopChange={(next) => update({ top: next })}
        onSizeChange={(size) => update({ size })}
        onCategoryChange={(category) => update({ category }, "push")}
      />

      {isPending ? (
        <HeatmapSkeleton tall={tall} />
      ) : error && !data ? (
        <ErrorState
          as="h2"
          title="Couldn't load the heatmap"
          error={error}
          retrying={isFetching}
          onRetry={() => void refetch()}
        />
      ) : !data?.length ? (
        <EmptyState
          as="h2"
          icon={Grid2x2}
          title="No assets here"
          description={
            state.category
              ? `${categoryLabel(state.category)} has nothing to show right now. Try another category.`
              : "There is nothing to show right now."
          }
        />
      ) : (
        <Treemap
          coins={data}
          period={state.period}
          size={state.size}
          universe={top}
          tall={tall}
          busy={isPlaceholderData}
        />
      )}

      <div className="space-y-4">
        <HeatmapLegend period={state.period} size={state.size} />
        {/* Tab enters the picture as one stop; these are the keys inside it. */}
        <p className="hidden text-body-sm text-muted md:block">
          Keyboard: Tab to the picture, then the arrow keys move between assets, Home and
          End jump to the first and last, and Enter opens one.
        </p>
      </div>
      {/* Refreshing is failing but the last picture is still on screen. */}
      {error && data && <LiveBadge status="offline" />}
    </div>
  );
}
