"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MarketsSkeleton } from "@/components/markets/markets-skeleton";
import { MarketsTable } from "@/components/markets/markets-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LiveBadge } from "@/components/ui/live-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { useRequestedIds } from "@/hooks/use-requested-ids";
import { useMarketsByIds } from "@/lib/api/hooks";
import { DEFAULT_DIR, sortCoins, type SortDir, type SortKey } from "@/lib/markets-table";
import { matchWatchlist } from "@/lib/watchlist";
import { useWatchlistHydrated, useWatchlistStore } from "@/stores/watchlist";
import { MissingAssets } from "./missing-assets";

/** How long "Clear all" waits for the confirming second press. */
const ARMED_MS = 4000;
/** The things that remove an asset: a row's star, or a missing asset's Remove button. */
const REMOVERS = "tbody button[aria-pressed], [data-missing-remove]";

/**
 * The saved assets, with live prices. The list itself lives in localStorage, so
 * the server can only render the frame: the rows appear once the store has been
 * read (see useWatchlistHydrated), never a flash of "nothing saved".
 */
export function WatchlistView() {
  const hydrated = useWatchlistHydrated();
  const ids = useWatchlistStore((s) => s.ids);
  const remove = useWatchlistStore((s) => s.remove);
  const clear = useWatchlistStore((s) => s.clear);

  /* ---- data ---------------------------------------------------------------
     What we ask the API for only ever grows (see useRequestedIds): removing an
     asset is instant and costs no upstream call. */
  const requested = useRequestedIds(ids, hydrated);
  const query = useMarketsByIds(requested);

  const { rows, missing } = useMemo(
    () => (query.data ? matchWatchlist(ids, query.data) : { rows: [], missing: [] }),
    [ids, query.data],
  );

  /* ---- sorting (local: the list is small and personal, not worth a URL) --- */
  const [sorting, setSorting] = useState<{ key: SortKey; dir: SortDir }>({
    key: "rank",
    dir: "asc",
  });
  const sorted = useMemo(
    () => sortCoins(rows, sorting.key, sorting.dir),
    [rows, sorting],
  );
  const onSort = (key: SortKey) =>
    setSorting((s) =>
      key === s.key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: DEFAULT_DIR[key] },
    );

  /* ---- "Clear all": the first press arms it, the second confirms ---------- */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), ARMED_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  /* ---- focus -------------------------------------------------------------
     Removing the focused star deletes the element that held focus, which would
     drop keyboard users back at the top of the page. Hand focus to the next
     remove control instead (or the heading when nothing is left). */
  const root = useRef<HTMLDivElement>(null);
  const focusedAt = useRef(-1);
  const focusHeading = useRef(false);
  const removable = sorted.length + missing.length;
  const previousRemovable = useRef(removable);

  useEffect(() => {
    const shrunk = removable < previousRemovable.current;
    previousRemovable.current = removable;
    if (!shrunk) return;

    const heading = root.current?.querySelector("h1");
    const active = document.activeElement;
    const lostFocus = !active || active === document.body;
    if (!focusHeading.current && !lostFocus) return;

    const controls = [...(root.current?.querySelectorAll<HTMLElement>(REMOVERS) ?? [])];
    const next =
      !focusHeading.current && focusedAt.current >= 0
        ? controls[Math.min(focusedAt.current, controls.length - 1)]
        : undefined;
    focusHeading.current = false;
    if (next) next.focus();
    else if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [removable]);

  /* ---- render ------------------------------------------------------------- */
  const offline = query.isError && Boolean(query.data);
  const count = ids.length;

  let body: React.ReactNode;
  if (!hydrated) {
    body = <MarketsSkeleton rows={5} label="Loading your watchlist" />;
  } else if (count === 0) {
    body = (
      <EmptyState
        as="h2"
        icon={Star}
        title="Nothing on your watchlist yet"
        description="Tap the star next to any asset and it shows up here with its live price. The list stays in this browser: no account, no sign-up."
        action={
          <Link href="/markets" className={buttonVariants({ variant: "secondary" })}>
            Browse markets
          </Link>
        }
      />
    );
  } else if (query.isPending) {
    body = <MarketsSkeleton rows={Math.min(count, 10)} label="Loading your watchlist" />;
  } else if (query.isError && !query.data) {
    body = (
      <ErrorState
        as="h2"
        title="Couldn't load your watchlist"
        error={query.error}
        retrying={query.isFetching}
        onRetry={query.refetch}
      />
    );
  } else if (sorted.length > 0) {
    body = (
      <MarketsTable
        rows={sorted}
        sort={sorting.key}
        dir={sorting.dir}
        onSort={onSort}
        caption="Your watchlist. Column headers are buttons that sort the table; the star removes an asset."
      />
    );
  }

  return (
    <div
      ref={root}
      className="space-y-10"
      onFocus={(event) => {
        const controls = [...(root.current?.querySelectorAll(REMOVERS) ?? [])];
        focusedAt.current = controls.indexOf(event.target as Element);
      }}
    >
      <SectionHeading
        as="h1"
        label="Watchlist"
        title="Your watchlist"
        description="The assets you've starred, with live prices. Saved in this browser, so they're still here next time."
        action={
          hydrated && count > 0 ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onBlur={() => setArmed(false)}
                onClick={() => {
                  if (!armed) return setArmed(true);
                  focusHeading.current = true;
                  setArmed(false);
                  clear();
                }}
              >
                {armed ? `Remove all ${count}?` : "Clear all"}
              </Button>
              <span role="status" className="sr-only">
                {armed ? `Press again to remove all ${count} assets.` : ""}
              </span>
            </>
          ) : undefined
        }
      />

      <div className="space-y-4">
        {/* A fixed minimum height: the skeleton, the rows and the empty state all
            fit in it, so the footer doesn't jump while the list loads. */}
        <div className="min-h-[20.5rem] border-t border-primary">{body}</div>
        {/* Always rendered (even blank), so its row never pops in and pushes things. */}
        <div className="flex min-h-5 flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <p role="status" className="num text-mono-md text-muted">
            {sorted.length > 0
              ? `${sorted.length} ${sorted.length === 1 ? "asset" : "assets"}`
              : " "}
          </p>
          {hydrated && count > 0 && <LiveBadge status={offline ? "offline" : "live"} />}
        </div>
      </div>

      <MissingAssets ids={missing} onRemove={remove} />
    </div>
  );
}
