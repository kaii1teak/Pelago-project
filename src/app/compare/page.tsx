import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareSkeleton } from "@/components/compare/compare-skeleton";
import { CompareView } from "@/components/compare/compare-view";
import { SectionHeading } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "Compare",
  description:
    "Put two to four crypto assets on one chart as percent change from the same starting point, with their key figures side by side.",
};

/**
 * Static: the selection lives in this browser (and in the link), so there is no
 * per-request data to prefetch. The heading is in the page's own HTML; the view
 * reads the URL, which needs a Suspense boundary, and fills in on the client.
 */
export default function ComparePage() {
  return (
    <div className="page-container space-y-12 pt-16">
      <SectionHeading
        as="h1"
        label="Compare"
        title="Compare assets"
        description="Pick up to four assets and see how they moved from the same starting point. A line at +20% gained a fifth of its value over the range, whatever its price."
      />
      <Suspense fallback={<CompareSkeleton />}>
        <CompareView />
      </Suspense>
    </div>
  );
}
