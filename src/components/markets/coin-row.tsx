"use client";

import Link from "next/link";
import { memo } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { CoinLogo } from "@/components/ui/coin-logo";
import { PercentChange } from "@/components/ui/percent-change";
import { Price } from "@/components/ui/price";
import { WatchButton } from "@/components/watchlist/watch-button";
import type { MarketCoin } from "@/lib/api/schemas";

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
export const CoinRow = memo(function CoinRow({ coin }: { coin: MarketCoin }) {
  return (
    <tr
      className={`${ROW_HEIGHT} border-b border-primary transition-colors duration-150 ease-standard last:border-b-0 hover:bg-overlay-hover`}
    >
      <td className="w-12 pr-0 pl-2">
        <WatchButton id={coin.id} name={coin.name} />
      </td>
      <td className="hidden w-12 px-3 num text-mono-md text-muted sm:table-cell">
        {coin.rank ?? "—"}
      </td>
      <td className="px-3">
        <Link
          href={`/coin/${coin.id}`}
          className="flex min-w-0 items-center gap-3 rounded-control py-1 transition-colors duration-150 ease-standard hover:text-secondary"
        >
          <CoinLogo src={coin.image} name={coin.name} size={32} />
          <span className="min-w-0 leading-tight">
            <span className="block max-w-[11rem] truncate text-body-lg text-primary sm:max-w-[16rem]">
              {coin.name}
            </span>
            <span className="num text-mono-sm text-muted">{coin.symbol}</span>
          </span>
        </Link>
      </td>
      <td className="px-3 text-right">
        <Price value={coin.price} className="text-mono-md text-primary" />
      </td>
      <td className="hidden px-3 text-right lg:table-cell">
        <PercentChange value={coin.change1h} className="text-mono-sm" />
      </td>
      <td className="px-3 text-right">
        <PercentChange value={coin.change24h} className="text-mono-sm" />
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
    </tr>
  );
});
