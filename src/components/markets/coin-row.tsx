"use client";

import { motion, useIsPresent, useReducedMotion } from "motion/react";
import { memo, useState } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { CoinLink } from "@/components/motion/coin-link";
import { LiveChange, LivePrice } from "@/components/live/live-price";
import { SharedCoin } from "@/components/motion/shared-coin";
import { CoinLogo } from "@/components/ui/coin-logo";
import { PercentChange } from "@/components/ui/percent-change";
import { Price } from "@/components/ui/price";
import { WatchButton } from "@/components/watchlist/watch-button";
import type { MarketCoin } from "@/lib/api/schemas";
import { DURATION, EASE_STANDARD } from "@/lib/motion";
import { isFirstPage } from "@/lib/session-state";

// Shared with the skeleton so the two can never drift apart (no shift on load).
export const ROW_HEIGHT = "h-16";

/**
 * One table row. Memoized: TanStack Query keeps the identity of coins that
 * didn't change between refreshes, so a live refresh only re-renders the rows
 * whose data actually moved.
 *
 * Columns drop out as the screen narrows (see the matching <th>s in
 * MarketsTable): phones keep star, name, price and 24h.
 */
export const CoinRow = memo(function CoinRow({
  coin,
  index = 0,
}: {
  coin: MarketCoin;
  /** Its position in the list: rows glide when sorting changes it, and enter one after another. */
  index?: number;
}) {
  // Rows that arrive after the first page ease in, a few ms apart. The first page's rows are
  // already in the server HTML, so they stay put. Decided once, when the row first appears.
  const [enters] = useState(() => !isFirstPage());
  // Leaving (fading out): still drawn for a moment, but nothing in it can be used or focused.
  const present = useIsPresent();
  // `motion`'s reduced-motion setting spares layout animations, so say it here: with the
  // setting on, a sorted list simply reorders.
  const reduce = useReducedMotion();

  return (
    <motion.tr
      // Position only (no stretching), and only measured when its place in the list changes:
      // a live price refresh must not trigger layout work on 100 rows.
      layout={reduce ? false : "position"}
      layoutDependency={index}
      inert={!present}
      // The selected row of keyboard navigation (j / k): focusable, but not a Tab stop.
      data-hotkey-row
      tabIndex={-1}
      initial={enters ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: DURATION.fast, ease: EASE_STANDARD } }}
      transition={{
        duration: DURATION.base,
        ease: EASE_STANDARD,
        delay: enters ? Math.min(index, ENTER_STAGGER_ROWS) * ENTER_STAGGER_S : 0,
        layout: { duration: DURATION.slow, ease: EASE_STANDARD },
      }}
      className={`${ROW_HEIGHT} scroll-mt-28 scroll-mb-6 border-b border-primary transition-colors duration-fast ease-standard last:border-b-0 hover:bg-overlay-hover focus-visible:bg-overlay-hover focus-visible:-outline-offset-2`}
    >
      <td className="w-12 pr-0 pl-2">
        <WatchButton id={coin.id} name={coin.name} />
      </td>
      <td className="hidden w-12 px-3 num text-mono-md text-muted sm:table-cell">
        {coin.rank ?? "—"}
      </td>
      <td className="px-3">
        <CoinLink
          coin={coin}
          className="flex min-w-0 items-center gap-3 rounded-control py-1 transition-colors duration-fast ease-standard hover:text-secondary"
        >
          <SharedCoin id={coin.id} part="logo">
            <CoinLogo src={coin.image} name={coin.name} size={32} />
          </SharedCoin>
          <SharedCoin id={coin.id} part="name">
            <span className="min-w-0 leading-tight">
              <span className="block max-w-[11rem] truncate text-body-lg text-primary sm:max-w-[16rem]">
                {coin.name}
              </span>
              <span className="num text-mono-sm text-muted">{coin.symbol}</span>
            </span>
          </SharedCoin>
        </CoinLink>
      </td>
      <td className="px-3 text-right">
        <SharedCoin id={coin.id} part="price">
          <LivePrice coin={coin} className="text-mono-md text-primary" />
        </SharedCoin>
      </td>
      <td className="hidden px-3 text-right lg:table-cell">
        <PercentChange value={coin.change1h} className="text-mono-sm" />
      </td>
      <td className="px-3 text-right">
        <LiveChange coin={coin} className="text-mono-sm" />
      </td>
      <td className="hidden px-3 text-right md:table-cell">
        <PercentChange value={coin.change7d} className="text-mono-sm" />
      </td>
      <td className="hidden px-3 text-right md:table-cell">
        <Price value={coin.marketCap} compact className="text-mono-md text-primary" />
      </td>
      <td className="hidden px-3 text-right lg:table-cell">
        <Price value={coin.volume24h} compact className="text-mono-md text-secondary" />
      </td>
      <td className="hidden w-44 px-3 lg:table-cell">
        <Sparkline data={coin.sparkline} className="ml-auto h-8 w-32" />
      </td>
    </motion.tr>
  );
});

/** Only the first screenful staggers; the rest arrive with the last of them. */
const ENTER_STAGGER_ROWS = 10;
const ENTER_STAGGER_S = 0.025;
