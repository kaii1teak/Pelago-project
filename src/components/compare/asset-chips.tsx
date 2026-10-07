"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoinLogo } from "@/components/ui/coin-logo";
import { PercentChange } from "@/components/ui/percent-change";
import { Skeleton } from "@/components/ui/skeleton";
import { COMPARE_COLOR_TOKENS } from "@/lib/compare";

export type AssetChipData = {
  id: string;
  /** Position in the comparison: sets the color. */
  slot: number;
  name: string;
  symbol: string | null;
  image: string | null;
  /** Percent change over the range, once the chart has loaded. */
  change: number | null;
  state: "loading" | "ready" | "error" | "missing";
};

/** The swatch tying a chip (and a table column) to its line on the chart. */
export function Swatch({ slot, className }: { slot: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className ?? "h-6 w-1 shrink-0"}
      style={{
        backgroundColor: `var(${COMPARE_COLOR_TOKENS[slot % COMPARE_COLOR_TOKENS.length]})`,
      }}
    />
  );
}

/**
 * The assets being compared, as a legend: color, name, how each did over the
 * range, and a remove button. A chip whose chart failed says so and offers a retry
 * rather than silently missing from the graph.
 */
export function AssetChips({
  assets,
  onRemove,
  onRetry,
}: {
  assets: readonly AssetChipData[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  if (assets.length === 0) return null;
  return (
    <ul aria-label="Assets being compared" className="flex flex-wrap gap-3">
      {assets.map((asset) => (
        <li
          key={asset.id}
          className="flex h-[3.625rem] items-center gap-3 border border-primary pr-1 pl-3"
        >
          <Swatch slot={asset.slot} className="h-8 w-1 shrink-0" />
          <CoinLogo src={asset.image} name={asset.name} size={24} />
          <span className="min-h-10 min-w-0 leading-tight">
            <span className="block max-w-[10rem] truncate text-body-md text-primary">
              {asset.name}
            </span>
            {asset.symbol && (
              <span className="num text-mono-sm text-muted">{asset.symbol}</span>
            )}
          </span>
          <span className="min-w-14 text-right">
            {asset.state === "loading" ? (
              <Skeleton className="ml-auto h-5 w-14" />
            ) : asset.state === "ready" ? (
              <PercentChange value={asset.change} className="text-mono-sm" />
            ) : asset.state === "error" ? (
              <Button variant="ghost" size="sm" onClick={() => onRetry(asset.id)}>
                Retry
              </Button>
            ) : (
              <span className="text-body-sm text-critical">Not found</span>
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${asset.name}`}
            data-chip-remove=""
            onClick={() => onRemove(asset.id)}
            className="size-8"
          >
            <X aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
