"use client";

import { useState } from "react";
import { Pagination } from "@/components/ui/pagination";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { WatchButton } from "@/components/watchlist/watch-button";

const VIEWS = [
  { value: "all", label: "All" },
  { value: "gainers", label: "Gainers" },
  { value: "losers", label: "Losers" },
] as const;

/** Interactive pieces (state, handlers) have to live in a Client Component. */
export function ControlsDemo() {
  const [view, setView] = useState<(typeof VIEWS)[number]["value"]>("all");
  const [page, setPage] = useState(5);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-4">
        <p className="label-mono text-muted">Segmented control (a filter, not tabs)</p>
        <SegmentedControl
          label="Show"
          value={view}
          onValueChange={setView}
          options={VIEWS}
        />
      </div>
      <div className="space-y-4">
        <p className="label-mono text-muted">Watch toggle (saved in your browser)</p>
        <WatchButton
          id="styleguide-demo"
          name="Demo coin"
          className="border border-primary"
        />
      </div>
      <div className="space-y-4 md:col-span-2">
        <p className="label-mono text-muted">Pagination, page {page} of 20</p>
        <Pagination page={page} pageCount={20} onPageChange={setPage} />
      </div>
    </div>
  );
}
