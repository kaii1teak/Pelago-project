"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SharedCoinTarget } from "@/components/motion/shared-coin";
import { NAV_BACK } from "@/components/motion/view-transition";
import { CoinLogo } from "@/components/ui/coin-logo";
import { Badge } from "@/components/ui/badge";
import { PercentChange } from "@/components/ui/percent-change";
import { Price } from "@/components/ui/price";
import { CompareLink } from "@/components/compare/compare-link";
import { WatchButton } from "@/components/watchlist/watch-button";
import type { CoinDetail } from "@/lib/api/schemas";
import { setSubject } from "@/lib/shared-subject";

export function PriceHeader({ coin }: { coin: CoinDetail }) {
  // Remembered so that going back to a list morphs this header into the coin's row.
  const { id, name, symbol, image } = coin;
  const price = coin.market.price;
  useEffect(() => {
    setSubject({ id, name, symbol, image, price });
  }, [id, name, symbol, image, price]);

  return (
    <header className="space-y-8">
      <nav aria-label="Breadcrumb" className="label-mono text-muted">
        <ol className="flex items-center gap-2">
          <li>
            <Link
              href="/markets"
              transitionTypes={[NAV_BACK]}
              className="-my-1 inline-block py-1 transition-colors duration-fast ease-standard hover:text-primary"
            >
              Markets
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-primary">
            {coin.name}
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <SharedCoinTarget part="logo">
            <CoinLogo src={coin.image} name={coin.name} size={48} />
          </SharedCoinTarget>
          <SharedCoinTarget part="name">
            <div className="space-y-2">
              <h1 className="text-heading-xl text-primary">{coin.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-mono-md text-muted">{coin.symbol}</span>
                {coin.rank != null && <Badge variant="outline">Rank #{coin.rank}</Badge>}
              </div>
            </div>
          </SharedCoinTarget>
        </div>
        <div className="flex items-center gap-2">
          <CompareLink id={coin.id} name={coin.name} />
          <WatchButton id={coin.id} name={coin.name} className="border border-outline" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <SharedCoinTarget part="price">
          <Price value={coin.market.price} className="text-heading-lg text-primary" />
        </SharedCoinTarget>
        <PercentChange value={coin.market.change24h} className="text-mono-md" />
        <span className="label-mono text-muted">24h</span>
      </div>
    </header>
  );
}
