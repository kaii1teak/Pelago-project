"use client";

import { Plus } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CoinLogo } from "@/components/ui/coin-logo";
import { Input } from "@/components/ui/input";
import type { MarketCoin } from "@/lib/api/schemas";
import { MAX_COMPARE } from "@/lib/compare";
import { filterCoins } from "@/lib/markets-table";

const MAX_OPTIONS = 8;

/**
 * "Add an asset": a combobox over the top assets (WAI-ARIA list autocomplete).
 * The input keeps focus the whole time; arrow keys move a highlight that is
 * announced through aria-activedescendant. When the comparison is full it stays
 * focusable but read-only (aria-disabled), because a truly disabled input would
 * drop keyboard focus the moment the last asset is added.
 */
export function AssetPicker({
  coins,
  status,
  selectedIds,
  onPick,
  onRetry,
  inputRef,
}: {
  coins: readonly MarketCoin[] | undefined;
  status: "loading" | "error" | "ready";
  selectedIds: readonly string[];
  onPick: (coin: MarketCoin) => void;
  onRetry: () => void;
  /** Lets the page hand focus back to the search box. */
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const base = useId();
  const listId = `${base}-list`;
  const hintId = `${base}-hint`;
  const full = selectedIds.length >= MAX_COMPARE;

  const results = useMemo(() => {
    if (!coins) return [];
    const free = coins.filter((c) => !selectedIds.includes(c.id));
    return filterCoins(free, { q: query, view: "all" }).slice(0, MAX_OPTIONS);
  }, [coins, selectedIds, query]);

  const activeIndex = Math.min(active, Math.max(0, results.length - 1));
  const optionId = (i: number) => `${base}-option-${i}`;
  const expanded = open && !full;

  const pick = (coin: MarketCoin) => {
    onPick(coin);
    setQuery("");
    setActive(0);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (full) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpen(true);
        else if (results.length) setActive((activeIndex + 1) % results.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) setOpen(true);
        else if (results.length)
          setActive((activeIndex - 1 + results.length) % results.length);
        break;
      case "Enter":
        if (expanded && results[activeIndex]) {
          event.preventDefault();
          pick(results[activeIndex]!);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        } else setQuery("");
        break;
    }
  };

  let message: string | null = null;
  if (status === "loading") message = "Loading assets…";
  else if (status === "ready" && results.length === 0) {
    message = query.trim()
      ? `No assets match “${query.trim()}”.`
      : "Every top asset is already in the comparison.";
  }

  return (
    <div className="relative max-w-md">
      <label htmlFor={`${base}-input`} className="sr-only">
        Add an asset to compare
      </label>
      <Input
        ref={inputRef}
        id={`${base}-input`}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          expanded && results.length ? optionId(activeIndex) : undefined
        }
        aria-disabled={full}
        aria-describedby={full ? hintId : undefined}
        readOnly={full}
        autoComplete="off"
        spellCheck={false}
        icon={<Plus />}
        placeholder={
          full ? `Up to ${MAX_COMPARE} assets` : "Add an asset: name or symbol"
        }
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={full ? "cursor-not-allowed text-muted" : undefined}
      />
      {full && (
        <p id={hintId} className="mt-2 text-body-sm text-muted">
          You can compare up to {MAX_COMPARE} assets. Remove one to add another.
        </p>
      )}

      {expanded && (
        // mousedown must not blur the input, or the click would land on a closed list.
        // tabIndex -1: Chrome makes a scrolling box a Tab stop of its own, so without it
        // Tab from the input would land here, the list would close and focus be dropped.
        <div
          tabIndex={-1}
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-80 overflow-auto border border-strong bg-primary shadow-dropdown"
          onMouseDown={(event) => event.preventDefault()}
        >
          {status === "error" && (
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <span className="text-body-md text-secondary">
                Couldn&apos;t load the asset list.
              </span>
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            </div>
          )}
          {message && (
            <p role="status" className="px-3 py-3 text-body-md text-muted">
              {message}
            </p>
          )}
          {results.length > 0 && (
            <ul id={listId} role="listbox" aria-label="Assets">
              {results.map((coin, i) => (
                <li
                  key={coin.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(coin)}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 aria-selected:bg-overlay-hover"
                >
                  <CoinLogo src={coin.image} name={coin.name} size={24} />
                  <span className="min-w-0 flex-1 truncate text-body-md text-primary">
                    {coin.name}
                  </span>
                  <span className="num text-mono-sm text-muted">{coin.symbol}</span>
                  <span className="w-10 text-right num text-mono-sm text-muted">
                    {coin.rank ? `#${coin.rank}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
