"use client";

import dynamic from "next/dynamic";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PercentChange } from "@/components/ui/percent-change";
import { Price } from "@/components/ui/price";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChartUrlState } from "@/hooks/use-chart-url-state";
import { HotkeyTip } from "@/components/shortcuts/hotkey-tip";
import { Tooltip } from "@/components/ui/tooltip";
import type { HotkeyId } from "@/lib/hotkeys/catalog";
import { useHotkey } from "@/hooks/use-hotkey";
import { useLiveCoin, useLiveKline } from "@/hooks/use-live";
import { liveSymbol } from "@/lib/live/symbols";
import { useCoinChartHistory, useCoinOhlc } from "@/lib/api/hooks";
import {
  CHART_RANGES,
  RANGE_NAME,
  isChartRange,
  type ChartRange,
  type ChartMode,
  type ChartScale,
} from "@/lib/chart";
import {
  summarizeCandles,
  summarizeLine,
  type Candle,
  type LinePoint,
} from "@/lib/chart-data";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChartControls, CrosshairInfo } from "./chart-canvas";
import { ChartLegend } from "./chart-legend";

// The charting library is ~45KB and only this page needs it, so it loads on demand,
// in a box of the final size so the page doesn't jump when it arrives.
const ChartCanvas = dynamic(() => import("./chart-canvas"), {
  ssr: false,
  loading: () => <Skeleton className="h-chart w-full rounded-none" />,
});

const MODE_OPTIONS = [
  { value: "line", label: "Line" },
  { value: "candle", label: "Candles" },
] as const satisfies readonly { value: ChartMode; label: string }[];

const SCALE_OPTIONS = [
  { value: "price", label: "Price" },
  { value: "percent", label: "%" },
] as const satisfies readonly { value: ChartScale; label: string }[];

// Stable references: a new [] each render would re-feed the chart on every update.
const NO_LINE: readonly LinePoint[] = [];
const NO_CANDLES: readonly Candle[] = [];

function SummaryCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-primary px-4 py-4 max-md:border-b md:not-first:border-l">
      <dt className="label-mono text-muted">{label}</dt>
      <dd className="num text-mono-md text-primary">{children}</dd>
    </div>
  );
}

/**
 * One line under the chart: how to go back in time (and what is happening while it
 * does). It is a live region, so loading and failures are announced too.
 */
function ChartHint({
  mode,
  loading,
  error,
  reachedStart,
  scrollable,
}: {
  mode: ChartMode;
  loading: boolean;
  error: { retry: () => unknown } | null;
  reachedStart: boolean;
  scrollable: boolean;
}) {
  let text = "";
  if (mode === "candle") {
    text =
      "Candles cover the selected range only. Switch to Line to scroll further back.";
  } else if (error) {
    text = "Couldn't load earlier data.";
  } else if (loading) {
    text = "Loading earlier data…";
  } else if (reachedStart) {
    text = "That is the earliest data available.";
  } else if (scrollable) {
    text = "Drag the chart to go back in time. Ctrl + scroll or the buttons zoom.";
  } else {
    text = "Ctrl + scroll or the buttons zoom. The 1Y chart already holds the full year.";
  }

  return (
    <p
      role="status"
      className="mt-3 flex min-h-6 flex-wrap items-center gap-x-3 num text-mono-sm text-muted"
    >
      {text}
      {error && (
        <Button variant="ghost" size="sm" onClick={() => void error.retry()}>
          Try again
        </Button>
      )}
    </p>
  );
}

/** Each range's shortcut: the catalog id, and the key for aria-keyshortcuts. */
const RANGE_HOTKEY = {
  "24h": "chart.24h",
  "7d": "chart.7d",
  "30d": "chart.30d",
  "1y": "chart.1y",
} as const satisfies Record<ChartRange, HotkeyId>;
const RANGE_KEY = { "24h": "1", "7d": "2", "30d": "3", "1y": "4" } as const;

export function PriceChart({
  id,
  name,
  symbol,
  rank = null,
  price = null,
}: {
  id: string;
  name: string;
  /** With the ticker, the rank and the last polled price, the end of the chart follows the live feed. */
  symbol?: string;
  rank?: number | null;
  price?: number | null;
}) {
  const { range, mode, scale, setRange, setMode, setScale } = useChartUrlState();
  // The line chart can be scrolled back through time: `history` holds the timeframe's own
  // window plus every older stretch loaded since. Candles have no older data to offer.
  const history = useCoinChartHistory(id, range, mode === "line");
  const line = history.base;
  const ohlc = useCoinOhlc(id, range, mode === "candle");
  const [hover, setHover] = useState<CrosshairInfo | null>(null);
  const controls = useRef<ChartControls | null>(null);
  const [resetKey, setResetKey] = useState(0);

  // The live feed: its price, and (once a price has come, so only for a symbol that exists) the
  // high and low of its current minute, so the last bar can't miss a spike between two prices.
  const feed = useLiveCoin({ symbol: symbol ?? "", rank, price });
  const kline = useLiveKline(feed.live && symbol ? liveSymbol(symbol, rank) : null);
  const liveBar = useMemo(
    () =>
      feed.live && feed.price != null
        ? { price: feed.price, high: kline?.high, low: kline?.low }
        : null,
    [feed.live, feed.price, kline?.high, kline?.low],
  );

  /** Back to the latest window of the timeframe, dropping any older history. */
  const showLatest = () => {
    history.reset();
    setResetKey((k) => k + 1);
  };

  // Keyboard: 1-4 pick the range (the one already showing means "back to the latest", as
  // pressing its tab again does), c switches between line and candles.
  const pickRange = (next: ChartRange) =>
    next === range ? showLatest() : setRange(next);
  useHotkey("chart.24h", () => pickRange("24h"));
  useHotkey("chart.7d", () => pickRange("7d"));
  useHotkey("chart.30d", () => pickRange("30d"));
  useHotkey("chart.1y", () => pickRange("1y"));
  useHotkey("chart.mode", () => setMode(mode === "line" ? "candle" : "line"));

  const query = mode === "line" ? line : ohlc;
  // What is on the chart (all loaded history) vs. what the timeframe's numbers describe
  // (its own window: scrolling back must not change "7D change").
  const allLine = history.data ?? NO_LINE;
  const lineData = line.data ?? NO_LINE;
  const candleData = ohlc.data ?? NO_CANDLES;
  const series = mode === "line" ? lineData : candleData;
  const summary =
    mode === "line" ? summarizeLine(lineData) : summarizeCandles(candleData);

  const lastPoint: CrosshairInfo | null =
    mode === "line"
      ? lineData.length
        ? { time: lineData.at(-1)!.time, value: lineData.at(-1)!.value }
        : null
      : candleData.length
        ? { ...candleData.at(-1)! }
        : null;

  const label = summary
    ? `${name} price over ${RANGE_NAME[range]}: from ${formatUsd(summary.first)} to ${formatUsd(summary.last)}, high ${formatUsd(summary.high)}, low ${formatUsd(summary.low)}.`
    : `${name} price chart over ${RANGE_NAME[range]}.`;

  let panel: React.ReactNode;
  if (query.isPending) {
    panel = (
      <div role="status" aria-busy="true" aria-label="Loading chart">
        <Skeleton className="h-chart w-full rounded-none" />
      </div>
    );
  } else if (query.isError && !query.data) {
    panel = (
      <div className="flex h-chart flex-col items-center justify-center gap-2">
        <ErrorState
          title="Couldn't load the chart"
          error={query.error}
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
          className="py-6"
        />
        {mode === "candle" && (
          <Button variant="ghost" size="sm" onClick={() => setMode("line")}>
            Show the line chart instead
          </Button>
        )}
      </div>
    );
  } else if (series.length < 2) {
    panel = (
      <div className="flex h-chart items-center justify-center">
        <EmptyState
          title="No chart data for this range"
          description="CoinGecko doesn't have enough history for this asset yet. Try a shorter range."
        />
      </div>
    );
  } else {
    panel = (
      <div
        role="img"
        aria-label={label}
        className={cn(
          "relative h-chart transition-opacity duration-base ease-standard",
          query.isPlaceholderData && "opacity-60",
        )}
      >
        <ChartLegend info={hover ?? lastPoint} mode={mode} range={range} />
        <ChartCanvas
          mode={mode}
          line={allLine}
          candles={candleData}
          range={range}
          onCrosshair={setHover}
          scale={scale}
          hasMore={history.hasMore}
          onNearStart={history.loadOlder}
          resetKey={resetKey}
          controlsRef={controls}
          live={liveBar}
        />
      </div>
    );
  }

  return (
    <section aria-labelledby="chart-heading" className="space-y-0">
      <h2 id="chart-heading" className="sr-only">
        Price chart
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
              <Tooltip
                key={r}
                content={<HotkeyTip label={RANGE_NAME[r]} id={RANGE_HOTKEY[r]} />}
              >
                <TabsTrigger
                  value={r}
                  className="num"
                  aria-keyshortcuts={RANGE_KEY[r]}
                  // Radix only reports a CHANGE of tab; pressing the one that is already
                  // selected means "show me the latest again" (after scrolling back in time).
                  onClick={() => {
                    if (r === range) showLatest();
                  }}
                >
                  {r.toUpperCase()}
                </TabsTrigger>
              </Tooltip>
            ))}
          </TabsList>
          <div className="flex flex-wrap items-center gap-3">
            {mode === "line" && (
              <SegmentedControl
                label="Price axis"
                value={scale}
                onValueChange={setScale}
                options={SCALE_OPTIONS}
              />
            )}
            <SegmentedControl
              label="Chart type"
              value={mode}
              onValueChange={setMode}
              options={MODE_OPTIONS}
            />
            <div role="group" aria-label="Zoom" className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Zoom out"
                onClick={() => controls.current?.zoomOut()}
              >
                <Minus aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Zoom in"
                onClick={() => controls.current?.zoomIn()}
              >
                <Plus aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="sm" onClick={showLatest}>
                <RotateCcw aria-hidden="true" />
                Latest
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value={range} forceMount className="mt-0 border-t border-primary">
          {panel}
        </TabsContent>
      </Tabs>

      <ChartHint
        mode={mode}
        loading={history.loadingOlder}
        error={history.olderError}
        reachedStart={history.reachedStart}
        scrollable={mode === "line" && range !== "1y"}
      />

      {summary && (
        <div
          role="group"
          aria-label={`${RANGE_NAME[range]} summary`}
          className="grid grid-cols-2 border-t border-primary md:grid-cols-5 md:border-b"
        >
          <dl className="contents">
            <SummaryCell label="Start">
              <Price value={summary.first} tweenKey={range} />
            </SummaryCell>
            <SummaryCell label="Latest">
              <Price value={summary.last} tweenKey={range} />
            </SummaryCell>
            <SummaryCell label="High">
              <Price value={summary.high} tweenKey={range} />
            </SummaryCell>
            <SummaryCell label="Low">
              <Price value={summary.low} tweenKey={range} />
            </SummaryCell>
            <SummaryCell label="Change">
              <PercentChange
                value={summary.change}
                tweenKey={range}
                className="text-mono-sm"
              />
            </SummaryCell>
          </dl>
        </div>
      )}
    </section>
  );
}
