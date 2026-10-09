"use client";

import { useLayoutEffect, useRef } from "react";
import { CoinLink } from "@/components/motion/coin-link";
import { CoinLogo } from "@/components/ui/coin-logo";
import { PercentChange } from "@/components/ui/percent-change";
import { Price } from "@/components/ui/price";
import { useLiveCoin } from "@/hooks/use-live";
import {
  HEAT_PERIODS,
  PERIOD_LABEL,
  changeFor,
  placeTip,
  type HeatCoin,
  type HeatPeriod,
} from "@/lib/heatmap";
import { cn } from "@/lib/utils";

/**
 * What a cell is, in full: the details a small cell has no room for. It follows the pointer
 * (or sits by the focused cell), and flips and clamps to stay inside the picture. Drawn only
 * for the eyes: the cell's own accessible name already says all of this, so it is hidden
 * from screen readers (a touch user who taps a cell gets it pinned, with a link to open the
 * asset, since a tap can't hover).
 */
export function HeatTip({
  coin,
  period,
  anchor,
  frame,
  interactive,
}: {
  coin: HeatCoin;
  period: HeatPeriod;
  anchor: { x: number; y: number };
  frame: { w: number; h: number };
  /** Pinned by a tap: it can be pressed (a link to the asset). */
  interactive: boolean;
}) {
  const live = useLiveCoin(coin);
  const ref = useRef<HTMLDivElement>(null);

  // Measured and placed here, on the element, not through state: its size depends on the
  // coin it shows, and a state update per pointer move would render the whole picture.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const { left, top } = placeTip(
      anchor,
      { w: element.offsetWidth, h: element.offsetHeight },
      frame,
    );
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-heat-tip=""
      className={cn(
        "absolute z-10 w-64 space-y-3 rounded-control border border-strong bg-primary p-3 text-body-sm shadow-dropdown",
        interactive ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <div className="flex items-center gap-2">
        <CoinLogo src={coin.image} name={coin.name} size={24} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-body-md font-medium text-primary">{coin.name}</p>
          <p className="num text-mono-sm text-muted">
            {coin.symbol}
            {coin.rank != null && ` · #${coin.rank}`}
          </p>
        </div>
        <Price value={live.price} className="text-mono-md text-primary" />
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {HEAT_PERIODS.map((p) => (
          <div key={p} className="space-y-1">
            <dt
              className={cn("label-mono", p === period ? "text-primary" : "text-muted")}
            >
              {PERIOD_LABEL[p]}
            </dt>
            <dd>
              <PercentChange
                value={p === "24h" ? live.change24h : changeFor(coin, p)}
                showIcon={false}
                className="px-0 text-mono-sm"
              />
            </dd>
          </div>
        ))}
      </dl>

      <dl className="grid grid-cols-2 gap-2 border-t border-primary pt-3">
        <div className="space-y-1">
          <dt className="label-mono text-muted">Market cap</dt>
          <dd>
            <Price value={coin.marketCap} compact className="text-mono-sm text-primary" />
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="label-mono text-muted">24h volume</dt>
          <dd>
            <Price value={coin.volume24h} compact className="text-mono-sm text-primary" />
          </dd>
        </div>
      </dl>

      {interactive && (
        <CoinLink
          coin={coin}
          tabIndex={-1}
          className="inline-flex h-9 w-full items-center justify-center rounded-control bg-btn-primary text-body-md font-medium text-btn-primary-text transition-colors duration-fast ease-standard hover:bg-btn-primary-hover"
        >
          Open {coin.name}
        </CoinLink>
      )}
    </div>
  );
}
