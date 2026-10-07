"use client";

import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { CoinLogo } from "@/components/ui/coin-logo";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PercentChange } from "@/components/ui/percent-change";
import { Price } from "@/components/ui/price";
import { RowIndex } from "@/components/ui/row-index";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkets } from "@/lib/api/hooks";
import type { MarketCoin } from "@/lib/api/schemas";
import { topMovers } from "@/lib/market";

const ROWS = 5;
const ROW = "h-[4.5rem] border-b border-primary";
const COLUMNS =
  "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_6rem_auto]";

function MoverRow({ coin, index }: { coin: MarketCoin; index: number }) {
  return (
    <li className={ROW}>
      <Link
        href={`/coin/${coin.id}`}
        className={`${COLUMNS} h-full px-2 transition-colors duration-150 ease-standard hover:bg-overlay-hover`}
      >
        <RowIndex n={index + 1} />
        <span className="flex min-w-0 items-center gap-3">
          <CoinLogo src={coin.image} name={coin.name} size={32} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-body-lg text-primary">{coin.name}</span>
            <span className="num text-mono-sm text-muted">{coin.symbol}</span>
          </span>
        </span>
        <Sparkline data={coin.sparkline} className="hidden h-7 sm:block" />
        <span className="flex flex-col items-end gap-1">
          <Price value={coin.price} className="text-mono-md text-primary" />
          <PercentChange value={coin.change24h} className="text-mono-sm" />
        </span>
      </Link>
    </li>
  );
}

function MoverSkeletonRows() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading movers">
      {Array.from({ length: ROWS }, (_, i) => (
        <div key={i} className={`${ROW} ${COLUMNS} px-2`}>
          <Skeleton className="h-3 w-6" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-10" />
            </div>
          </div>
          <Skeleton className="hidden h-7 w-full sm:block" />
          <div className="space-y-2">
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="ml-auto h-4 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MoverList({
  title,
  icon: Icon,
  coins,
  pending,
}: {
  title: string;
  icon: LucideIcon;
  coins: MarketCoin[];
  pending: boolean;
}) {
  return (
    <div>
      <div className="flex h-12 items-center gap-3 border-t border-b border-primary px-2">
        <Icon className="size-4 text-secondary" aria-hidden="true" />
        <h3 className="label-mono text-primary">{title}</h3>
        <span className="ml-auto label-mono text-muted">24h change · 7d trend</span>
      </div>
      {pending ? (
        <MoverSkeletonRows />
      ) : coins.length === 0 ? (
        <EmptyState
          icon={Icon}
          title="No movers right now"
          description="Nothing in the top 100 has moved in this direction in the last 24 hours."
          className="py-10"
        />
      ) : (
        <ul>
          {coins.map((coin, i) => (
            <MoverRow key={coin.id} coin={coin} index={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function MoversSection() {
  const { data, error, isPending, isFetching, refetch } = useMarkets();
  const { gainers, losers } = useMemo(
    () => (data ? topMovers(data, ROWS) : { gainers: [], losers: [] }),
    [data],
  );

  return (
    <section aria-labelledby="movers-heading" className="space-y-12">
      <SectionHeading
        id="movers-heading"
        label="Top movers"
        title="Biggest moves in 24 hours"
        description="Among the top 100 assets by market cap."
      />

      {error && !data ? (
        <div className="border-t border-primary">
          <ErrorState
            title="Couldn't load market movers"
            error={error}
            retrying={isFetching}
            onRetry={() => void refetch()}
          />
        </div>
      ) : (
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-x-16">
          <MoverList
            title="Top gainers"
            icon={TrendingUp}
            coins={gainers}
            pending={isPending}
          />
          <MoverList
            title="Top losers"
            icon={TrendingDown}
            coins={losers}
            pending={isPending}
          />
        </div>
      )}
    </section>
  );
}
