"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsWatched, useWatchlistStore } from "@/stores/watchlist";

/**
 * Star toggle that adds/removes a coin from the watchlist.
 * The accessible name stays constant ("Watch Bitcoin") and `aria-pressed`
 * carries the state, so screen readers say "Watch Bitcoin, toggle button,
 * pressed" instead of a label that flips and double-announces.
 */
export function WatchButton({
  id,
  name,
  className,
}: {
  id: string;
  name: string;
  className?: string;
}) {
  const watched = useIsWatched(id);
  const toggle = useWatchlistStore((s) => s.toggle);

  return (
    <Tooltip content={watched ? "Remove from watchlist" : "Add to watchlist"}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Watch ${name}`}
        aria-pressed={watched}
        onClick={() => toggle(id)}
        className={cn(
          "size-10",
          watched ? "text-accent" : "text-muted",
          "[&_svg]:transition-[fill,color] [&_svg]:duration-base",
          className,
        )}
      >
        <Star className={cn(watched && "fill-current")} aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}
