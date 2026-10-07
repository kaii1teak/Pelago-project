"use client";

import { Pause, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CoinLogo } from "@/components/ui/coin-logo";
import { PercentChange } from "@/components/ui/percent-change";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkets } from "@/lib/api/hooks";
import type { MarketCoin } from "@/lib/api/schemas";
import { cn } from "@/lib/utils";

const COUNT = 20;

function Item({ coin }: { coin: MarketCoin }) {
  return (
    <li>
      <Link
        href={`/coin/${coin.id}`}
        // Redundant with Trending/Markets, so keep the strip to ONE tab stop (the Pause button)
        // instead of 20. Still in the accessibility tree: screen readers can follow them.
        tabIndex={-1}
        className="flex h-14 items-center gap-3 border-r border-primary px-6 transition-colors duration-150 ease-standard hover:bg-overlay-hover"
      >
        <CoinLogo src={coin.image} name={coin.name} size={24} />
        <span className="num text-mono-md text-primary">{coin.symbol}</span>
        <Price value={coin.price} className="text-mono-md text-secondary" />
        <PercentChange value={coin.change24h} className="text-mono-sm" />
      </Link>
    </li>
  );
}

/**
 * Endless strip of top assets. The list is rendered twice and the track slides
 * by half its width, so the loop is seamless. Accessibility:
 *  - a real Pause button (hover alone isn't enough: WCAG 2.2.2 needs a control
 *    that works for keyboard and touch), plus pause on hover
 *  - the duplicate list is hidden from assistive tech and not focusable (inert)
 *  - reduced motion: no animation at all; it becomes a normal scrollable row
 */
export function AssetMarquee() {
  const { data, isPending } = useMarkets();
  const [paused, setPaused] = useState(false);

  if (isPending) {
    return (
      <div aria-hidden="true" className="h-14 border-y border-primary">
        <Skeleton className="h-full rounded-none" />
      </div>
    );
  }
  // The stats strip above already owns the error state for this data.
  if (!data?.length) return null;

  const coins = data.slice(0, COUNT);

  return (
    <section aria-label="Top assets" className="flex border-y border-primary">
      <button
        type="button"
        aria-pressed={paused}
        aria-label="Pause ticker"
        onClick={() => setPaused((p) => !p)}
        className="flex h-14 w-14 shrink-0 items-center justify-center border-r border-primary text-secondary transition-colors duration-150 ease-standard hover:bg-overlay-hover hover:text-primary motion-reduce:hidden"
      >
        {paused ? (
          <Play className="size-4" aria-hidden="true" />
        ) : (
          <Pause className="size-4" aria-hidden="true" />
        )}
      </button>

      <div className="min-w-0 flex-1 overflow-hidden motion-reduce:overflow-x-auto">
        <div
          className={cn(
            "flex w-max animate-marquee hover:[animation-play-state:paused] motion-reduce:animate-none",
            paused && "[animation-play-state:paused]",
          )}
        >
          <ul className="flex">
            {coins.map((coin) => (
              <Item key={coin.id} coin={coin} />
            ))}
          </ul>
          <ul className="flex motion-reduce:hidden" aria-hidden="true" inert>
            {coins.map((coin) => (
              <Item key={coin.id} coin={coin} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
