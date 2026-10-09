"use client";

import { Price } from "@/components/ui/price";
import { PercentChange } from "@/components/ui/percent-change";
import { useLiveCoin } from "@/hooks/use-live";
import type { LiveSource } from "@/lib/live/symbols";
import { cn } from "@/lib/utils";
import { useFlash } from "./flash";

/**
 * A coin's price, live where there is a live price and as polled where there isn't, and it
 * flashes green or red when it changes. Only this small piece re-renders on a tick, never
 * the row around it.
 */
export function LivePrice({ coin, className }: { coin: LiveSource; className?: string }) {
  const { price } = useLiveCoin(coin);
  const ref = useFlash<HTMLSpanElement>(price);
  return (
    // Padding and an equal negative margin: the flash gets a little room, the layout none.
    <Price
      ref={ref}
      value={price}
      className={cn("-mx-1 rounded-control px-1", className)}
    />
  );
}

/** The 24-hour change at the live price. */
export function LiveChange({
  coin,
  className,
}: {
  coin: LiveSource;
  className?: string;
}) {
  const { change24h } = useLiveCoin(coin);
  return <PercentChange value={change24h} className={className} />;
}
