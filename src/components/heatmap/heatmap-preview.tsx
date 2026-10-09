"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ErrorState } from "@/components/ui/error-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { useMarkets } from "@/lib/api/hooks";
import { HeatmapLegend } from "./heatmap-legend";
import { HeatmapSkeleton } from "./heatmap-skeleton";
import { Treemap } from "./treemap";

/** A small picture of the market is a small number of cells. */
const PREVIEW_COUNT = 30;

/**
 * The home page's taste of the heatmap: the biggest assets by market cap, colored by the
 * last 24 hours. It draws from the markets list the page already holds, so it costs no
 * request of its own.
 */
export function HeatmapPreview() {
  const { data, error, isPending, isFetching, refetch } = useMarkets();

  return (
    <section aria-labelledby="heatmap-heading" className="space-y-12">
      <SectionHeading
        id="heatmap-heading"
        label="Heatmap"
        title="The whole market in one picture"
        description="Every cell is an asset. The bigger the cell, the bigger the asset; the greener or redder, the more it moved in the last 24 hours."
        action={
          <Link
            href="/heatmap"
            className="group inline-flex items-center gap-1.5 text-body-md text-secondary transition-colors duration-fast ease-standard hover:text-primary"
          >
            Open the heatmap
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />

      <div className="space-y-6">
        {isPending ? (
          <HeatmapSkeleton density="compact" />
        ) : error && !data ? (
          <ErrorState
            title="Couldn't load the heatmap"
            error={error}
            retrying={isFetching}
            onRetry={() => void refetch()}
          />
        ) : (
          data && (
            <Treemap
              coins={data}
              period="24h"
              size="cap"
              universe={PREVIEW_COUNT}
              density="compact"
            />
          )
        )}
        <HeatmapLegend period="24h" size="cap" />
      </div>
    </section>
  );
}
