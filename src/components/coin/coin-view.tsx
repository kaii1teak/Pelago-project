"use client";

import { SearchX } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useCoin } from "@/lib/api/hooks";
import { AboutSection } from "./about-section";
import { CoinLinks } from "./coin-links";
import { CoinSkeleton } from "./coin-skeleton";
import { KeyStats } from "./key-stats";
import { PriceChart } from "./price-chart";
import { PriceHeader } from "./price-header";

/**
 * The whole asset page body. The server prefetches the coin into the query
 * cache, so this normally renders straight from the first HTML; it also covers
 * client-side navigation, a failed prefetch, and a coin that doesn't exist.
 */
export function CoinView({ id }: { id: string }) {
  const { data: coin, error, isPending, isFetching, refetch } = useCoin(id);

  if (isPending) return <CoinSkeleton />;

  if (!coin) {
    if (error?.code === "not_found") {
      return (
        <EmptyState
          icon={SearchX}
          title="We couldn't find that asset"
          description="It may have been delisted, or the link is mistyped."
          action={
            <Link href="/markets" className={buttonVariants({ variant: "outline" })}>
              Browse markets
            </Link>
          }
        />
      );
    }
    return (
      <ErrorState
        title="Couldn't load this asset"
        error={error}
        retrying={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <FadeIn className="space-y-20 md:space-y-28">
      <PriceHeader coin={coin} />
      <PriceChart id={coin.id} name={coin.name} />
      <KeyStats coin={coin} />
      <AboutSection coin={coin} />
      <CoinLinks coin={coin} />
    </FadeIn>
  );
}
