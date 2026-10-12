import {HydrationBoundary, dehydrate} from "@tanstack/react-query";
import {HeatmapPreview} from "@/components/heatmap/heatmap-preview";
import {Hero} from "@/components/hero/hero";
import {AssetMarquee} from "@/components/home/asset-marquee";
import {CtaSection} from "@/components/home/cta-section";
import {FeaturesSection} from "@/components/home/features-section";
import {MoversSection} from "@/components/home/movers-section";
import {TrendingSection} from "@/components/home/trending-section";
import {Reveal} from "@/components/motion/reveal";
import {getGlobalStats, getMarkets, getTrending} from "@/lib/api/endpoints";
import {getQueryClient} from "@/lib/api/query-client";
import {queryKeys} from "@/lib/api/query-keys";
import {Analytics} from "@vercel/analytics/next";

// The page itself is rebuilt at most once a minute; the data inside is cached
// per endpoint (see REVALIDATE), so visitors share one upstream call.
export const revalidate = 60;

export default async function HomePage() {
    const queryClient = getQueryClient();

    // Fill the query cache on the server so the first HTML already contains real
    // numbers instead of skeletons. `retry: false`: if the upstream is failing,
    // fall through to client-side loading rather than stalling this render on
    // backoff. prefetchQuery never throws, so a failure just means "no initial data".
    await Promise.all([
        queryClient.prefetchQuery({
            queryKey: queryKeys.global,
            queryFn: async () => (await getGlobalStats()).data,
            retry: false,
        }),
        queryClient.prefetchQuery({
            queryKey: queryKeys.markets(),
            queryFn: async () => (await getMarkets()).data,
            retry: false,
        }),
        queryClient.prefetchQuery({
            queryKey: queryKeys.trending,
            queryFn: async () => (await getTrending()).data,
            retry: false,
        }),
    ]);

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <Hero/>
            <AssetMarquee/>
            <div className="page-container mt-section space-y-section">
                <Reveal>
                    <TrendingSection/>
                </Reveal>
                <Reveal>
                    <MoversSection/>
                </Reveal>
                <Reveal>
                    <HeatmapPreview/>
                </Reveal>
            </div>
            {/* No gap around the features on desktop: its vertical rule runs the full height
          of the pinned panel and should meet the sections above and below. */}
            <div className="mt-section lg:mt-0">
                <FeaturesSection/>
            </div>
            <div className="mt-section lg:mt-0">
                <CtaSection/>
            </div>
        </HydrationBoundary>
    );
}
