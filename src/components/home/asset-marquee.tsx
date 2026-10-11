"use client";

import Link from "next/link";
import { useRef } from "react";
import { LiveChange, LivePrice } from "@/components/live/live-price";
import { CoinLogo } from "@/components/ui/coin-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useStuck } from "@/hooks/use-stuck";
import { useMarkets } from "@/lib/api/hooks";
import type { MarketCoin } from "@/lib/api/schemas";

const COUNT = 20;

function Item({ coin }: { coin: MarketCoin }) {
  return (
    <li>
      <Link
        href={`/coin/${coin.id}`}
        // Redundant with Trending/Markets, so the strip has no tab stops at all (not 20).
        // Still in the accessibility tree: screen readers can follow them.
        tabIndex={-1}
        // Stuck (data-stuck on the strip): the same size as the strip on the other pages.
        className="flex h-[calc(var(--strip-home-h)-2px)] items-center gap-3 border-r border-primary px-6 transition-[height,gap,padding,background-color] duration-base ease-standard group-data-[stuck=true]/strip:h-[calc(var(--strip-stuck-h)-1px)] group-data-[stuck=true]/strip:gap-2 group-data-[stuck=true]/strip:px-4 hover:bg-overlay-hover active:bg-overlay-pressed"
      >
        <CoinLogo
          src={coin.image}
          name={coin.name}
          size={24}
          className="transition-[width,height] duration-base ease-standard group-data-[stuck=true]/strip:size-4"
        />
        <span className="num text-mono-md text-primary transition-[font-size,line-height] duration-base ease-standard group-data-[stuck=true]/strip:text-mono-sm">
          {coin.symbol}
        </span>
        <LivePrice
          coin={coin}
          className="text-mono-md text-secondary transition-[font-size,line-height] duration-base ease-standard group-data-[stuck=true]/strip:text-mono-sm"
        />
        <LiveChange coin={coin} className="text-mono-sm" />
      </Link>
    </li>
  );
}

/**
 * The strip itself. Its box is always the same height (so the page never shifts), and it
 * sticks 20px or so higher than where it shows, with the top part under the header. Once
 * it is stuck its items shrink to the size of the strip on the other pages and sit in the
 * part that shows.
 */
function Strip({ coins }: { coins: MarketCoin[] }) {
  const ref = useRef<HTMLElement>(null);
  useStuck(ref);

  return (
    <section
      ref={ref}
      aria-label="Top assets"
      className="group/strip sticky top-home-strip z-30 flex h-[var(--strip-home-h)] items-end border-y border-primary bg-primary"
    >
      <div className="min-w-0 flex-1 overflow-hidden motion-reduce:overflow-x-auto">
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused] motion-reduce:animate-none">
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

/**
 * Endless strip of top assets. The list is rendered twice and the track slides
 * by half its width, so the loop is seamless.
 *  - it is sticky: it sits in its place under the hero, sticks under the header when the
 *    page is scrolled past it, and goes back to its place when scrolled up. While it sticks
 *    it is as small as the strip on the other pages (see Strip)
 *  - it pauses while hovered; there is no Pause button (a design decision: the strip
 *    is decoration repeating Trending and Markets, with nothing to operate)
 *  - the duplicate list is hidden from assistive tech and not focusable (inert)
 *  - reduced motion: no animation at all; it becomes a normal scrollable row
 */
export function AssetMarquee() {
  const { data, isPending } = useMarkets();

  if (isPending) {
    return (
      <div
        aria-hidden="true"
        className="sticky top-home-strip z-30 h-[var(--strip-home-h)] border-y border-primary bg-primary"
      >
        <Skeleton className="h-full rounded-none" />
      </div>
    );
  }
  // The stats strip above already owns the error state for this data.
  if (!data?.length) return null;

  return <Strip coins={data.slice(0, COUNT)} />;
}
