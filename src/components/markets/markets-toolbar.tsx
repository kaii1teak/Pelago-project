"use client";

import { Search, X } from "lucide-react";
import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { LiveBadge } from "@/components/ui/live-badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { CATEGORIES } from "@/lib/categories";
import type { MoversView } from "@/lib/markets-table";
import { cn } from "@/lib/utils";

const VIEW_OPTIONS = [
  { value: "all", label: "All" },
  { value: "gainers", label: "Gainers" },
  { value: "losers", label: "Losers" },
] as const satisfies readonly { value: MoversView; label: string }[];

export function MarketsToolbar({
  search,
  onSearchChange,
  onSearchClear,
  view,
  onViewChange,
  category,
  onCategoryChange,
  offline,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  view: MoversView;
  onViewChange: (view: MoversView) => void;
  category: string | null;
  onCategoryChange: (category: string | null) => void;
  /** Refreshing is failing but old data is still on screen. */
  offline: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Input
            ref={inputRef}
            type="search"
            aria-label="Search assets"
            data-hotkey-search
            placeholder="Search name or symbol"
            icon={<Search />}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            className="pr-10 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                onSearchClear();
                // The button unmounts once the box is empty; keep keyboard users where they were.
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-control text-muted transition-colors duration-fast ease-standard hover:bg-overlay-hover hover:text-primary active:bg-overlay-pressed"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <SegmentedControl
          label="Show"
          value={view}
          onValueChange={onViewChange}
          options={VIEW_OPTIONS}
        />
      </div>

      <div
        role="group"
        aria-label="Category"
        className="-mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {[{ id: null, label: "All assets" }, ...CATEGORIES].map((c) => {
          const active = c.id === category;
          return (
            <button
              key={c.id ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => onCategoryChange(c.id)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-control border px-3 text-body-md whitespace-nowrap transition-colors duration-fast ease-standard",
                active
                  ? "border-transparent bg-inverse text-inverse"
                  : "border-primary text-secondary hover:bg-overlay-hover hover:text-primary active:bg-overlay-pressed",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {offline && <LiveBadge status="offline" />}
    </div>
  );
}
