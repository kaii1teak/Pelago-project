"use client";

import { GitCompareArrows } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChartUrlState } from "@/hooks/use-chart-url-state";
import { useCompareUrlSync } from "@/hooks/use-compare-url-sync";
import { useRequestedIds } from "@/hooks/use-requested-ids";
import { useCoinCharts, useMarkets, useMarketsByIds } from "@/lib/api/hooks";
import { isApiError } from "@/lib/api/errors";
import type { MarketCoin } from "@/lib/api/schemas";
import { CHART_DAYS, CHART_RANGES, RANGE_NAME, isChartRange } from "@/lib/chart";
import {
  MAX_COMPARE,
  alignPercentSeries,
  findLateStarter,
  totalReturn,
} from "@/lib/compare";
import { formatDate, formatPercent } from "@/lib/format";
import { useCompareHydrated, useCompareStore } from "@/stores/compare";
import { AssetChips, type AssetChipData } from "./asset-chips";
import { AssetPicker } from "./asset-picker";
import type { CompareCrosshair, CompareSeries } from "./compare-canvas";
import { CompareLegend } from "./compare-legend";
import { CompareSkeleton } from "./compare-skeleton";
import { CompareStats, type StatsAsset } from "./compare-stats";

// The charting library only loads on this page, in a box of the final size.
const CompareCanvas = dynamic(() => import("./compare-canvas"), {
  ssr: false,
  loading: () => <Skeleton className="h-chart w-full rounded-none" />,
});

const NO_IDS: readonly string[] = [];
const NO_POINTS: readonly { time: number; value: number }[] = [];
/** A late-starting asset is worth a note when it shifts the shared start by more than this share of the range. */
const LATE_START_SHARE = 0.1;

/**
 * Compare up to four assets: their price moves, as percent change from a shared
 * start, on one chart, with the key figures side by side underneath. The selection
 * is saved in this browser and mirrored in the URL, so a link reproduces it.
 */
export function CompareView() {
  const hydrated = useCompareHydrated();
  const ids = useCompareStore((s) => s.ids);
  const add = useCompareStore((s) => s.add);
  const remove = useCompareStore((s) => s.remove);
  const setIds = useCompareStore((s) => s.set);
  const { range, setRange } = useChartUrlState();
  useCompareUrlSync(hydrated, ids, setIds);

  /* ---- data --------------------------------------------------------------- */
  const requested = useRequestedIds(ids, hydrated);
  const markets = useMarketsByIds(requested); // names, figures: one request for all
  const top = useMarkets(); // what the picker offers
  const charts = useCoinCharts(hydrated ? ids : NO_IDS, range); // one per asset

  const coinById = useMemo(
    () => new Map<string, MarketCoin>((markets.data ?? []).map((c) => [c.id, c])),
    [markets.data],
  );

  // Every line is measured from the same moment, so "+12%" means the same stretch of time.
  const aligned = useMemo(
    () => alignPercentSeries(charts.map((c) => c.data ?? NO_POINTS)),
    [charts],
  );
  const lateStarter = useMemo(
    () =>
      findLateStarter(
        charts.map((c) => c.data ?? NO_POINTS),
        CHART_DAYS[range] * 86_400 * LATE_START_SHARE,
      ),
    [charts, range],
  );

  const assets: AssetChipData[] = ids.map((id, slot) => {
    const coin = coinById.get(id);
    const chart = charts[slot];
    const missing =
      chart?.isError && isApiError(chart.error) && chart.error.code === "not_found";
    return {
      id,
      slot,
      name: coin?.name ?? id,
      symbol: coin?.symbol ?? null,
      image: coin?.image ?? null,
      change: totalReturn(aligned.series[slot] ?? []),
      state: missing
        ? "missing"
        : chart?.isError
          ? "error"
          : chart?.isPending
            ? "loading"
            : "ready",
    };
  });

  const series = useMemo<CompareSeries[]>(
    () =>
      aligned.series.flatMap((points, slot) =>
        points.length > 1 && ids[slot] ? [{ id: ids[slot], slot, points }] : [],
      ),
    [aligned, ids],
  );

  const statsAssets: StatsAsset[] = assets.map((a) => ({
    id: a.id,
    slot: a.slot,
    name: a.name,
    image: a.image,
    coin: coinById.get(a.id),
    change: a.change,
    loading: markets.isPending,
  }));

  /* ---- interaction -------------------------------------------------------- */
  const [hover, setHover] = useState<CompareCrosshair | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const pickerInput = useRef<HTMLInputElement>(null);
  const focusAfterRemove = useRef<number | null>(null);

  const onPick = (coin: MarketCoin) => {
    add(coin.id);
    setAnnouncement(
      `Added ${coin.name}. Comparing ${Math.min(ids.length + 1, MAX_COMPARE)} assets.`,
    );
  };

  const onRemove = (id: string) => {
    focusAfterRemove.current = ids.indexOf(id);
    setAnnouncement(`Removed ${assets.find((a) => a.id === id)?.name ?? id}.`);
    remove(id);
  };

  // Removing the focused chip's button deletes the element that held focus: hand
  // focus to the next chip's remove button, or the search box when none is left.
  useEffect(() => {
    const index = focusAfterRemove.current;
    if (index === null) return;
    focusAfterRemove.current = null;
    const buttons = [
      ...(root.current?.querySelectorAll<HTMLElement>("[data-chip-remove]") ?? []),
    ];
    (buttons[Math.min(index, buttons.length - 1)] ?? pickerInput.current)?.focus();
  }, [ids.length]);

  /* ---- render ------------------------------------------------------------- */
  if (!hydrated) return <CompareSkeleton />;

  const retryAll = () => charts.forEach((c) => c.refetch());
  const allPending = charts.length > 0 && charts.every((c) => c.isPending);
  const allFailed = charts.length > 0 && charts.every((c) => c.isError);
  const rangeLabel = RANGE_NAME[range];

  const moves = assets
    .filter((a) => a.change !== null)
    .map((a) => `${a.name} ${formatPercent(a.change)}`);
  const chartLabel = moves.length
    ? `Percent change over ${rangeLabel}: ${moves.join(", ")}.`
    : `Percent change over ${rangeLabel}.`;

  let panel: React.ReactNode;
  if (ids.length === 0) {
    panel = (
      <div className="flex h-chart items-center justify-center">
        <EmptyState
          as="h2"
          icon={GitCompareArrows}
          title="Pick assets to compare"
          description={`Search above to add two to four assets. Their price moves are drawn from the same starting point, so you can see which one did better.`}
          action={
            <Button variant="secondary" onClick={() => setIds(["bitcoin", "ethereum"])}>
              Try Bitcoin vs Ethereum
            </Button>
          }
        />
      </div>
    );
  } else if (allPending) {
    panel = (
      <div role="status" aria-busy="true" aria-label="Loading the chart">
        <Skeleton className="h-chart w-full rounded-none" />
      </div>
    );
  } else if (allFailed) {
    panel = (
      <div className="flex h-chart items-center justify-center">
        <ErrorState
          as="h2"
          title="Couldn't load the chart"
          error={charts.find((c) => c.error)?.error}
          retrying={charts.some((c) => c.isFetching)}
          onRetry={retryAll}
          className="py-6"
        />
      </div>
    );
  } else if (series.length === 0) {
    panel = (
      <div className="flex h-chart items-center justify-center">
        <EmptyState
          as="h2"
          title="No chart data for this range"
          description="CoinGecko doesn't have enough history for these assets in this range. Try a shorter one."
        />
      </div>
    );
  } else {
    panel = (
      <div role="img" aria-label={chartLabel} className="relative h-chart">
        <CompareLegend
          info={hover}
          entries={assets.flatMap((a) =>
            a.symbol ? [{ id: a.id, slot: a.slot, symbol: a.symbol }] : [],
          )}
          range={range}
        />
        <CompareCanvas series={series} range={range} onCrosshair={setHover} />
      </div>
    );
  }

  const lateName = lateStarter ? assets[lateStarter.index]?.name : null;

  return (
    <div ref={root} className="space-y-12">
      <section aria-labelledby="selection-heading" className="space-y-4">
        <h2 id="selection-heading" className="sr-only">
          Assets to compare
        </h2>
        <AssetPicker
          coins={top.data}
          status={top.isError && !top.data ? "error" : top.data ? "ready" : "loading"}
          selectedIds={ids}
          onPick={onPick}
          onRetry={() => void top.refetch()}
          inputRef={pickerInput}
        />
        <AssetChips
          assets={assets}
          onRemove={onRemove}
          onRetry={(id) => charts[ids.indexOf(id)]?.refetch()}
        />
        {ids.length === 1 && (
          <p className="text-body-md text-secondary">
            Add another asset to compare it against.
          </p>
        )}
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </section>

      <section aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="sr-only">
          Performance chart
        </h2>
        <Tabs
          value={range}
          onValueChange={(next) => {
            if (isChartRange(next)) setRange(next);
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
            <TabsList aria-label="Time range" className="border-b-0">
              {CHART_RANGES.map((r) => (
                <TabsTrigger key={r} value={r} className="num">
                  {r.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
            <p className="num text-mono-sm text-muted">% change from a shared start</p>
          </div>
          <TabsContent value={range} forceMount className="mt-0 border-t border-primary">
            {panel}
          </TabsContent>
        </Tabs>
        {lateStarter && lateName && series.length > 0 && (
          <p className="mt-4 text-body-md text-secondary">
            {lateName} only has data since {formatDate(lateStarter.start * 1000)}, so
            every line starts there.
          </p>
        )}
      </section>

      {ids.length > 0 && (
        <section aria-labelledby="stats-heading" className="space-y-8">
          <SectionHeading
            id="stats-heading"
            label="Side by side"
            title="The numbers"
            description="Figures from CoinGecko, refreshed every minute."
          />
          <CompareStats assets={statsAssets} range={range} />
        </section>
      )}
    </div>
  );
}
