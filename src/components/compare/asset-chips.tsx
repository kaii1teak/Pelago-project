"use client";

import { X } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { PresenceLi } from "@/components/motion/presence-li";
import { Button } from "@/components/ui/button";
import { CoinLogo } from "@/components/ui/coin-logo";
import { PercentChange } from "@/components/ui/percent-change";
import { Skeleton } from "@/components/ui/skeleton";
import { DURATION, EASE_STANDARD, entering } from "@/lib/motion";
import { ColorPicker } from "./color-picker";

export type AssetChipData = {
  id: string;
  /** Its line color: an index into COMPARE_PALETTE. */
  color: number;
  name: string;
  symbol: string | null;
  image: string | null;
  /** Percent change over the range, once the chart has loaded. */
  change: number | null;
  state: "loading" | "ready" | "error" | "missing";
};

/**
 * The assets being compared, as a legend: color (click it to change), name, how
 * each did over the range, and a remove button. A chip whose chart failed says so
 * and offers a retry rather than silently missing from the graph.
 */
export function AssetChips({
  assets,
  onRemove,
  onRetry,
  onColor,
}: {
  assets: readonly AssetChipData[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onColor: (id: string, color: number) => void;
}) {
  const reduce = useReducedMotion();
  if (assets.length === 0) return null;
  return (
    <ul aria-label="Assets being compared" className="flex flex-wrap gap-3">
      {/* popLayout: a removed chip leaves at once and the others close the gap smoothly.
          initial={false}: the chips already there don't animate in on load. */}
      <AnimatePresence initial={false} mode="popLayout">
        {assets.map((asset) => (
          <PresenceLi
            key={asset.id}
            layout={reduce ? false : "position"}
            initial={entering({ opacity: 0, scale: 0.96 })}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: DURATION.base, ease: EASE_STANDARD }}
            className="flex h-[3.625rem] items-center gap-3 border border-primary pr-1 pl-3"
          >
            <ColorPicker
              assetName={asset.name}
              value={asset.color}
              onChange={(color) => onColor(asset.id, color)}
            />
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
          </PresenceLi>
        ))}
      </AnimatePresence>
    </ul>
  );
}
