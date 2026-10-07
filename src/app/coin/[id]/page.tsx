import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoinView } from "@/components/coin/coin-view";
import { getCoin, getCoinChart } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/errors";
import { getQueryClient } from "@/lib/api/query-client";
import { queryKeys } from "@/lib/api/query-keys";
import { COIN_ID_PATTERN, DEFAULT_RANGE, isChartRange } from "@/lib/chart";

/** The id is user-controlled and ends up in upstream URLs; malformed ones can't exist. */
async function resolveId(params: PageProps<"/coin/[id]">["params"]) {
  const { id } = await params;
  return COIN_ID_PATTERN.test(id) ? id : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/coin/[id]">): Promise<Metadata> {
  const id = await resolveId(params);
  if (!id) return { title: "Asset not found" };
  try {
    const { data } = await getCoin(id);
    return {
      title: `${data.name} (${data.symbol}) price`,
      description: `Live ${data.name} price, chart and market stats.`,
    };
  } catch (error) {
    if (isApiError(error) && error.code === "not_found") {
      return { title: "Asset not found" };
    }
    // Upstream trouble: the page itself reports it, with a retry.
    return { title: "Asset" };
  }
}

/**
 * Dynamic (per request): the page reads the id and ?range, and an unknown coin
 * renders the designed not-found page. loading.tsx streams the skeleton first
 * (instant feedback on navigation), so the status is already 200 by then; Next
 * adds `noindex` so crawlers skip it. The data comes from the data cache, so
 * this adds no upstream calls.
 */
export default async function CoinPage({
  params,
  searchParams,
}: PageProps<"/coin/[id]">) {
  const id = await resolveId(params);
  if (!id) notFound();

  const rangeParam = (await searchParams).range;
  const range = isChartRange(rangeParam) ? rangeParam : DEFAULT_RANGE;

  const queryClient = getQueryClient();
  let missing = false;

  // The coin itself decides 404 vs page. Other failures (rate limit, outage)
  // fall through to the client, which shows a proper error with a retry.
  try {
    await queryClient.fetchQuery({
      queryKey: queryKeys.coin(id),
      queryFn: async () => (await getCoin(id)).data,
      retry: false,
    });
  } catch (error) {
    if (isApiError(error) && error.code === "not_found") missing = true;
  }
  if (missing) notFound();

  // Only the line chart for the requested range: candles are fetched on demand.
  await queryClient.prefetchQuery({
    queryKey: queryKeys.coinChart(id, range),
    queryFn: async () => (await getCoinChart(id, range)).data,
    retry: false,
  });

  return (
    <div className="page-container pt-12 md:pt-16">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CoinView id={id} />
      </HydrationBoundary>
    </div>
  );
}
