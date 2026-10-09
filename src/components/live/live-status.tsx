"use client";

import { Tooltip } from "@/components/ui/tooltip";
import { useLiveStatus } from "@/hooks/use-live";
import type { LiveStatus as Status } from "@/lib/live/types";
import { cn } from "@/lib/utils";

/** What each state says, in a word, and in a sentence for the tooltip. */
export const STATUS_TEXT: Record<Status, { label: string; hint: string }> = {
  idle: {
    label: "Prices",
    hint: "Prices refresh every minute.",
  },
  connecting: {
    label: "Connecting",
    hint: "Connecting to the live price feed. Prices still refresh every minute meanwhile.",
  },
  live: {
    label: "Live",
    hint: "Prices stream in live from Binance. A price flashes when it changes.",
  },
  reconnecting: {
    label: "Reconnecting",
    hint: "The live feed dropped and is being reconnected. Prices still refresh every minute meanwhile.",
  },
  paused: {
    label: "Paused",
    hint: "Live prices are paused while this tab is in the background. They resume when you come back.",
  },
  polling: {
    label: "Polling",
    hint: "The live feed can't be reached from here (it may be blocked by your network or region), so prices refresh every minute instead.",
  },
};

const DOT: Record<Status, string> = {
  idle: "bg-muted",
  connecting: "bg-warning",
  live: "bg-success",
  reconnecting: "bg-warning",
  paused: "bg-muted",
  polling: "bg-warning",
};

/**
 * The feed's state as a dot and a word. The dot is decoration, the word carries it, and the
 * tooltip says what it means (and, when the live feed is out of reach, that prices keep
 * coming once a minute: the fallback is quiet but not hidden).
 */
export function LiveStatus({ className }: { className?: string }) {
  const status = useLiveStatus();
  const { label, hint } = STATUS_TEXT[status];

  return (
    <Tooltip content={hint}>
      <span
        // A focusable status, so the tooltip is there for keyboard users too.
        tabIndex={0}
        role="status"
        aria-label={`${label}. ${hint}`}
        className={cn(
          "inline-flex items-center gap-2 rounded-control label-mono text-muted",
          className,
        )}
      >
        <span aria-hidden="true" className={cn("size-1.5 rounded-full", DOT[status])} />
        <span aria-hidden="true">{label}</span>
      </span>
    </Tooltip>
  );
}
