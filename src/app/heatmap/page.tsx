import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeatmapSkeleton } from "@/components/heatmap/heatmap-skeleton";
import { HeatmapView } from "@/components/heatmap/heatmap-view";
import { SectionHeading } from "@/components/ui/section-heading";
import { getHeatmap } from "@/lib/api/endpoints";
import { getQueryClient } from "@/lib/api/query-client";
import { queryKeys } from "@/lib/api/query-keys";

export const metadata: Metadata = {
  title: "Heatmap",
  description:
    "The crypto market as one picture: every asset sized by market cap or volume and colored by how far its price moved over an hour, a day or a week.",
};

// Built once a minute, like the home page. What the visitor chose (period, size, category) is
// in the URL and read in the browser, so the page itself stays static; the data for the
// default view is fetched here, and the view fills in from it.
export const revalidate = 60;

export default async function HeatmapPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.heatmap(),
    queryFn: async () => (await getHeatmap()).data,
    retry: false,
  });

  return (
    <div className="page-container space-y-12 pt-16">
      <SectionHeading
        as="h1"
        label="Heatmap"
        title="The market, by size and by move"
        description="Each cell is an asset. Its area shows its market cap or volume, its color how far the price moved. Pick a period, an asset count or a category to change the picture."
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<HeatmapSkeleton />}>
          <HeatmapView />
        </Suspense>
      </HydrationBoundary>
    </div>
  );
}
