"use client";

import { ArrowRight, Flame } from "lucide-react";
import Link from "next/link";
import { LiveChange, LivePrice } from "@/components/live/live-price";
import { CoinLink } from "@/components/motion/coin-link";
import { SharedCoin } from "@/components/motion/shared-coin";
import { CoinLogo } from "@/components/ui/coin-logo";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { RowIndex } from "@/components/ui/row-index";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrending } from "@/lib/api/hooks";
import type { TrendingCoin } from "@/lib/api/schemas";

const COUNT = 6;
// Shared by rows and skeleton rows so the list never changes height when data lands.
const ROW = "h-20 border-b border-primary";
const COLUMNS =
  "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 sm:grid-cols-[3rem_minmax(0,1fr)_5rem_9rem_7rem]";

function TrendingRow({ coin, index }: { coin: TrendingCoin; index: number }) {
  return (
    <li className={ROW}>
      <CoinLink
        coin={coin}
        className={`${COLUMNS} h-full px-2 transition-colors duration-fast ease-standard hover:bg-overlay-hover active:bg-overlay-pressed`}
      >
        <RowIndex n={index + 1} />
        <span className="flex min-w-0 items-center gap-3">
          <SharedCoin id={coin.id} part="logo">
            <CoinLogo src={coin.image} name={coin.name} size={32} />
          </SharedCoin>
          <SharedCoin id={coin.id} part="name">
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-body-lg text-primary">
                {coin.name}
              </span>
              <span className="num text-mono-sm text-muted">{coin.symbol}</span>
            </span>
          </SharedCoin>
        </span>
        <span className="hidden num text-mono-md text-muted sm:block">
          {coin.rank != null ? `#${coin.rank}` : ""}
        </span>
        {/* Phones have room for ONE column here: price over change. From `sm` the wrapper
            disappears (display: contents) and each is its own grid column. Without it
            the 4th item wrapped onto a second row and spilled out of the left edge. */}
        <span className="flex flex-col items-end gap-1 sm:contents">
          <span className="text-right">
            <SharedCoin id={coin.id} part="price">
              <LivePrice coin={coin} className="text-mono-md text-primary" />
            </SharedCoin>
          </span>
          <span className="flex justify-end">
            <LiveChange coin={coin} className="text-mono-sm" />
          </span>
        </span>
      </CoinLink>
    </li>
  );
}

function TrendingSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading trending assets">
      {Array.from({ length: COUNT }, (_, i) => (
        <div key={i} className={`${ROW} ${COLUMNS} px-2`}>
          <Skeleton className="h-3 w-6" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-10" />
            </div>
          </div>
          <Skeleton className="hidden h-4 w-10 sm:block" />
          <div className="flex flex-col items-end gap-1 sm:contents">
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="ml-auto h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TrendingSection() {
  const { data, error, isPending, isFetching, refetch } = useTrending();

  return (
    <section aria-labelledby="trending-heading" className="space-y-12">
      <SectionHeading
        id="trending-heading"
        label="Trending"
        title="What the market is looking at"
        description="The assets drawing the most attention right now, updated every few minutes."
        action={
          <Link
            href="/markets"
            className="group inline-flex items-center gap-1.5 text-body-md text-secondary transition-colors duration-fast ease-standard hover:text-primary"
          >
            View all markets
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />

      <div className="border-t border-primary">
        {isPending ? (
          <TrendingSkeleton />
        ) : error && !data ? (
          <ErrorState
            title="Couldn't load trending assets"
            error={error}
            retrying={isFetching}
            onRetry={() => void refetch()}
          />
        ) : !data?.length ? (
          <EmptyState
            icon={Flame}
            title="Nothing is trending yet"
            description="Check back in a few minutes."
          />
        ) : (
          <ul>
            {data.slice(0, COUNT).map((coin, i) => (
              <TrendingRow key={coin.id} coin={coin} index={i} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
