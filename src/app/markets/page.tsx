import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { MarketsExplorer } from "@/components/markets/markets-explorer";
import { SectionHeading } from "@/components/ui/section-heading";
import { getMarkets } from "@/lib/api/endpoints";
import { getQueryClient } from "@/lib/api/query-client";
import { queryKeys } from "@/lib/api/query-keys";
import { parseMarketsState } from "@/lib/markets-url";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "The top 100 crypto assets by market cap: live prices, 1h/24h/7d changes, volume and trends.",
};

/**
 * Dynamic on purpose (it reads searchParams). A *static* page that uses
 * useSearchParams client-renders everything up to its Suspense boundary, so the
 * server HTML would hold only a skeleton and the prefetch below would be
 * wasted. Rendering per request means the real table (for whatever search,
 * sort, filter and page is in the URL) is in the first HTML. The data itself is
 * still served from the data cache, so this doesn't add upstream calls.
 */
export default async function MarketsPage({ searchParams }: PageProps<"/markets">) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  const { category } = parseMarketsState(params);
  const marketsParams = category ? { category } : undefined;

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.markets(marketsParams),
    queryFn: async () => (await getMarkets(marketsParams)).data,
    retry: false,
  });

  return (
    <div className="page-container space-y-12 pt-16">
      <SectionHeading
        as="h1"
        label="Markets"
        title="Top 100 by market cap"
        description="Live prices, changes and trends. Sort any column, search by name or symbol, or filter by category."
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MarketsExplorer />
      </HydrationBoundary>
    </div>
  );
}
