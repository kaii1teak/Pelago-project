"use client";

import { useMemo } from "react";
import { CountUp, type CountUpFormat } from "@/components/motion/count-up";
import { ErrorState } from "@/components/ui/error-state";
import { LiveBadge } from "@/components/ui/live-badge";
import { PercentChange } from "@/components/ui/percent-change";
import { Skeleton } from "@/components/ui/skeleton";
import { useGlobalStats, useMarkets } from "@/lib/api/hooks";
import { formatInteger, formatPlainPercent } from "@/lib/format";
import { sumVolume } from "@/lib/market";

type Stat = {
  label: string;
  value: number | null | undefined;
  format: CountUpFormat;
  pending: boolean;
  foot: React.ReactNode;
};

function StatCell({ label, value, format, pending, foot }: Stat) {
  return (
    <div className="space-y-3 border-primary px-4 py-5 max-lg:odd:border-r max-lg:nth-[-n+2]:border-b lg:not-first:border-l">
      <dt className="label-mono text-muted">{label}</dt>
      <dd className="space-y-1">
        {/* Heights match the real content (value line + foot line) so nothing shifts on load. */}
        <div className="flex h-9 items-center text-heading-md text-primary">
          {pending ? (
            <Skeleton className="h-6 w-28" />
          ) : value == null ? (
            <span className="num text-muted">
              —<span className="sr-only">unavailable</span>
            </span>
          ) : (
            <CountUp value={value} format={format} />
          )}
        </div>
        <div className="flex h-6 items-center text-body-sm text-secondary">
          {pending ? <Skeleton className="h-3 w-24" /> : foot}
        </div>
      </dd>
    </div>
  );
}

/**
 * Headline market numbers. The first three come from CoinGecko's global
 * endpoint; 24h volume is summed from the top-100 markets data because the
 * global volume field is unreliable (see schemas.ts), so it's labeled as such.
 */
export function StatsStrip() {
  const global = useGlobalStats();
  const markets = useMarkets();

  const volume = useMemo(
    () => (markets.data ? sumVolume(markets.data) : null),
    [markets.data],
  );

  // Both sources down and nothing cached: say so once, with a retry.
  if (global.isError && markets.isError && !global.data && !markets.data) {
    return (
      <div className="border-t border-primary">
        <ErrorState
          title="Couldn't load market stats"
          error={global.error}
          retrying={global.isFetching || markets.isFetching}
          onRetry={() => {
            void global.refetch();
            void markets.refetch();
          }}
        />
      </div>
    );
  }

  const g = global.data;
  const stats: Stat[] = [
    {
      label: "Total market cap",
      value: g?.totalMarketCap,
      format: "compactUsd",
      pending: global.isPending,
      foot: (
        <span className="flex items-center gap-2">
          <PercentChange value={g?.marketCapChange24h} className="text-mono-sm" />
          <span className="text-muted">24h</span>
        </span>
      ),
    },
    {
      label: "24h volume",
      value: volume,
      format: "compactUsd",
      pending: markets.isPending,
      foot: "Top 100 assets",
    },
    {
      label: "Bitcoin dominance",
      value: g?.btcDominance,
      format: "plainPercent",
      pending: global.isPending,
      foot:
        g?.ethDominance != null ? `Ethereum ${formatPlainPercent(g.ethDominance)}` : null,
    },
    {
      label: "Assets tracked",
      value: g?.activeCryptocurrencies,
      format: "integer",
      pending: global.isPending,
      foot: g ? `On ${formatInteger(g.markets)} exchanges` : null,
    },
  ];

  const refreshFailing = global.isError || markets.isError;

  return (
    // line-fade-top (globals.css) draws the hairlines above the numbers and above the
    // live badge so that they fade out at both ends. Tune --line-fade-size there.
    <section aria-label="Market overview" className="line-fade-top">
      <dl className="grid grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCell key={stat.label} {...stat} />
        ))}
      </dl>
      <div className="line-fade-top px-4 py-3">
        <LiveBadge status={refreshFailing ? "offline" : "live"} />
      </div>
    </section>
  );
}
