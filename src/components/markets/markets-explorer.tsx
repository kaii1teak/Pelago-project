"use client";

import { SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMarketsUrlState } from "@/hooks/use-markets-url-state";
import { useMarkets } from "@/lib/api/hooks";
import { categoryLabel } from "@/lib/categories";
import type { MarketsState } from "@/lib/markets-url";
import {
  DEFAULT_DIR,
  filterCoins,
  paginate,
  sortCoins,
  type MoversView,
  type SortKey,
} from "@/lib/markets-table";
import { MarketsSkeleton } from "./markets-skeleton";
import { MarketsTable } from "./markets-table";
import { MarketsToolbar } from "./markets-toolbar";

const SEARCH_DEBOUNCE_MS = 250;

export function MarketsExplorer() {
  const { state, update } = useMarketsUrlState();
  const { q, sort, dir, view, category, page } = state;

  // keepPrevious: switching category keeps the old rows (dimmed) until the new
  // ones arrive, instead of flashing a skeleton.
  const query = useMarkets(category ? { category } : undefined, { keepPrevious: true });

  /* ---- search box: instant typing, debounced filtering ------------------- */
  // `draft` is what's in the input right now. It's committed to the URL (and so
  // to the filter) only after typing pauses.
  const [draft, setDraft] = useState(q);
  const debouncedDraft = useDebouncedValue(draft, SEARCH_DEBOUNCE_MS);

  // Two refs tell *our* URL writes apart from external ones (Back/Forward, a
  // pasted link), so the URL -> input sync below never fights the user's typing:
  //  - lastWritten: the query we most recently committed
  //  - ownWrites:   committed values still on their way back through the URL
  const lastWritten = useRef(q);
  const ownWrites = useRef(new Set<string>());
  const currentQ = useRef(q);
  useEffect(() => {
    currentQ.current = q;
  }, [q]);

  // Stable identity on purpose (only `update` can change it): the debounce effect
  // below must not re-run when the URL changes, or pressing Back mid-debounce
  // would write the stale typed text straight back over it.
  const writeQuery = useCallback(
    (
      next: string,
      extra: Partial<MarketsState> = {},
      mode: "replace" | "push" = "replace",
    ) => {
      lastWritten.current = next;
      if (next !== currentQ.current) ownWrites.current.add(next);
      update({ q: next, page: 1, ...extra }, mode);
    },
    [update],
  );

  useEffect(() => {
    const next = debouncedDraft.trim();
    if (next !== lastWritten.current) writeQuery(next);
  }, [debouncedDraft, writeQuery]);

  useEffect(() => {
    if (ownWrites.current.delete(q)) return; // our own write, echoed back by the URL
    if (q === lastWritten.current) return;
    // The URL changed under us (Back/Forward, a shared link): show it in the box.
    lastWritten.current = q;
    setDraft(q);
  }, [q]);

  const clearSearch = () => {
    setDraft("");
    writeQuery("");
  };

  /* ---- derived rows ------------------------------------------------------- */
  const coins = query.data;
  const filtered = useMemo(
    () => (coins ? filterCoins(coins, { q, view }) : []),
    [coins, q, view],
  );
  const sorted = useMemo(() => sortCoins(filtered, sort, dir), [filtered, sort, dir]);
  const current = paginate(sorted, page);

  // A link with ?page=9 on a 4-page list shows page 4; make the URL say so too.
  useEffect(() => {
    if (coins && page !== current.page) update({ page: current.page });
  }, [coins, page, current.page, update]);

  /* ---- handlers ----------------------------------------------------------- */
  const tableTop = useRef<HTMLDivElement>(null);

  const onSort = useCallback(
    (key: SortKey) => {
      update({
        sort: key,
        dir: key === sort ? (dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[key],
        page: 1,
      });
    },
    [update, sort, dir],
  );

  const onView = (next: MoversView) => {
    // "Gainers"/"Losers" are only useful ordered by the move itself.
    if (next === "gainers")
      update({ view: next, sort: "change24h", dir: "desc", page: 1 });
    else if (next === "losers")
      update({ view: next, sort: "change24h", dir: "asc", page: 1 });
    else update({ view: next, sort: "rank", dir: "asc", page: 1 });
  };

  const onPage = (next: number) => {
    update({ page: next }, "push");
    tableTop.current?.scrollIntoView({ block: "start" });
  };

  const clearFilters = () => {
    setDraft("");
    writeQuery("", { view: "all", category: null }, "push");
  };

  /* ---- render ------------------------------------------------------------- */
  const hasFilters = Boolean(q || view !== "all" || category);
  const offline = query.isError && Boolean(coins);

  let body: React.ReactNode;
  if (query.isPending) {
    body = <MarketsSkeleton />;
  } else if (query.isError && !coins) {
    body = (
      <ErrorState
        as="h2"
        title="Couldn't load markets"
        error={query.error}
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (current.total === 0) {
    body = (
      <EmptyState
        as="h2"
        icon={SearchX}
        title={q ? `No assets match “${q}”` : "No assets to show"}
        description={
          hasFilters
            ? `Nothing in ${category ? categoryLabel(category) : "the top 100"} fits these filters.`
            : "The market data came back empty. Try again in a moment."
        }
        action={
          hasFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <MarketsTable
        rows={current.items}
        sort={sort}
        dir={dir}
        onSort={onSort}
        busy={query.isPlaceholderData}
      />
    );
  }

  return (
    <div className="space-y-6">
      <MarketsToolbar
        search={draft}
        onSearchChange={setDraft}
        onSearchClear={clearSearch}
        view={view}
        onViewChange={onView}
        category={category}
        onCategoryChange={(next) => update({ category: next, page: 1 }, "push")}
        offline={offline}
      />

      {/* scroll-mt clears the sticky header and the strip of prices when paging scrolls here */}
      <div ref={tableTop} className="scroll-mt-32 space-y-4">
        <div className="border-t border-primary">{body}</div>

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p role="status" className="num text-mono-md text-muted">
            {coins && current.total > 0
              ? `Showing ${current.from}–${current.to} of ${current.total} assets`
              : " "}
          </p>
          <Pagination
            page={current.page}
            pageCount={current.pageCount}
            onPageChange={onPage}
          />
        </div>
      </div>
    </div>
  );
}
