import { MarketsSkeleton } from "@/components/markets/markets-skeleton";
import { SectionHeading } from "@/components/ui/section-heading";

/** Shown instantly on navigation while the server renders the table. Mirrors the page's layout. */
export default function Loading() {
  return (
    <div className="page-container space-y-12 pt-16">
      <SectionHeading
        as="h1"
        label="Markets"
        title="Top 100 by market cap"
        description="Live prices, changes and trends. Sort any column, search by name or symbol, or filter by category."
      />
      <div className="border-t border-primary">
        <MarketsSkeleton />
      </div>
    </div>
  );
}
