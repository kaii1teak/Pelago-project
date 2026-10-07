"use client";

import { CountUp } from "@/components/motion/count-up";
import { ErrorState } from "@/components/ui/error-state";
import { PercentChange } from "@/components/ui/percent-change";
import { Skeleton } from "@/components/ui/skeleton";
import { useGlobalStats } from "@/lib/api/hooks";

/**
 * End-to-end check of the data layer: browser -> /api/global -> CoinGecko,
 * validated by zod, with real loading, error and success states.
 */
export function LiveDataCheck() {
  const { data, error, isPending, isFetching, refetch } = useGlobalStats();

  if (isPending) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading market data"
        className="space-y-4 border border-primary p-6"
      >
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-24" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-primary">
        <ErrorState error={error} onRetry={() => refetch()} retrying={isFetching} />
      </div>
    );
  }

  return (
    <div className="space-y-3 border border-primary p-6">
      <p className="label-mono text-muted">Total crypto market cap (live)</p>
      <p className="text-heading-lg text-primary">
        <CountUp value={data.totalMarketCap} format="compactUsd" />
      </p>
      <p className="flex items-center gap-2 text-body-sm text-secondary">
        <PercentChange value={data.marketCapChange24h} className="text-mono-sm" /> in 24h
      </p>
    </div>
  );
}
