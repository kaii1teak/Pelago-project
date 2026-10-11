"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { CoinLogo } from "@/components/ui/coin-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkets } from "@/lib/api/hooks";
import type { MarketCoin } from "@/lib/api/schemas";
import { LiveStatus } from "./live-status";
import { LiveChange, LivePrice } from "./live-price";

const COUNT = 20;
/**
 * The strip needs 20 assets, not the 100 (with their sparklines) of the full list that the
 * Markets page and the home page already hold: a request for just enough, so the pages that
 * don't hold the list don't download all of it for a strip.
 */
export const TICKER_REQUEST = { perPage: 25 } as const;
/** The strip's height is reserved from the first paint, so the page never shifts when it fills. */
const HEIGHT = "h-9";

function Item({ coin }: { coin: MarketCoin }) {
  return (
    <li>
      <Link
        href={`/coin/${coin.id}`}
        // The same assets are in Markets; the strip adds no tab stops (screen readers can still follow the links).
        tabIndex={-1}
        className={`flex ${HEIGHT} items-center gap-2 border-r border-primary px-4 transition-colors duration-fast ease-standard hover:bg-overlay-hover active:bg-overlay-pressed`}
      >
        <CoinLogo src={coin.image} name={coin.name} size={16} />
        <span className="num text-mono-sm text-primary">{coin.symbol}</span>
        <LivePrice coin={coin} className="text-mono-sm text-secondary" />
        <LiveChange coin={coin} className="text-mono-sm" />
      </Link>
    </li>
  );
}

/**
 * A thin strip of the top assets under the header on every page but the home page (which has
 * its own, bigger one): endless, pausing under the pointer, with the state of the live feed
 * at its left end. No Pause button, as on the home page: it is decoration that repeats
 * Markets, with nothing to operate. Reduced motion: no animation, a plain scrollable row.
 */
export function TickerTape() {
  // The home page is the route with no segment under the root layout. That is read from the
  // route tree that is being rendered, NOT from the URL (usePathname): a prerendered page can
  // be rendered on the server under another path than the browser's (on Vercel the home page's
  // HTML came with this strip in it). A strip the server draws and the browser doesn't is never
  // cleaned up (React leaves unknown children of <body> alone), so it stayed above the page
  // and, after a client-side navigation, the real strip appeared under it.
  const segment = useSelectedLayoutSegment();
  // The strip is a component of its own so that its data is only asked for where it is shown:
  // on the home page, which has no strip here, nothing is fetched.
  return segment === null ? null : <Strip />;
}

function Strip() {
  const { data, isPending } = useMarkets(TICKER_REQUEST);
  const coins = data?.slice(0, COUNT) ?? [];

  return (
    <section
      aria-label="Live prices of the top assets"
      className={`flex ${HEIGHT} sticky top-header z-30 border-b border-primary bg-primary`}
    >
      <div className="flex shrink-0 items-center border-r border-primary px-4">
        <LiveStatus />
      </div>
      {isPending ? (
        <div aria-hidden="true" className="min-w-0 flex-1">
          <Skeleton className="h-full rounded-none" />
        </div>
      ) : coins.length > 0 ? (
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
      ) : (
        <div className="min-w-0 flex-1" />
      )}
    </section>
  );
}
