"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PercentChange } from "@/components/ui/percent-change";
import { Price } from "@/components/ui/price";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChartUrlState } from "@/hooks/use-chart-url-state";
import { useCoinChart, useCoinOhlc } from "@/lib/api/hooks";
import { CHART_RANGES, RANGE_NAME, isChartRange, type ChartMode } from "@/lib/chart";
import {
  summarizeCandles,
  summarizeLine,
  type Candle,
  type LinePoint,
} from "@/lib/chart-data";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CrosshairInfo } from "./chart-canvas";
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

export function PriceChart({ id, name }: { id: string; name: string }) {
  const { range, mode, setRange, setMode } = useChartUrlState();
  const line = useCoinChart(id, range);
  const ohlc = useCoinOhlc(id, range, mode === "candle");
  const [hover, setHover] = useState<CrosshairInfo | null>(null);

  const query = mode === "line" ? line : ohlc;
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
          "relative h-chart transition-opacity duration-250 ease-standard",
          query.isPlaceholderData && "opacity-60",
        )}
      >
        <ChartLegend info={hover ?? lastPoint} mode={mode} range={range} />
        <ChartCanvas
          mode={mode}
          line={lineData}
          candles={candleData}
          range={range}
          onCrosshair={setHover}
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
              <TabsTrigger key={r} value={r} className="num">
                {r.toUpperCase()}
              </TabsTrigger>
            ))}
          </TabsList>
          <SegmentedControl
            label="Chart type"
            value={mode}
            onValueChange={setMode}
            options={MODE_OPTIONS}
          />
        </div>

        <TabsContent value={range} forceMount className="mt-0 border-t border-primary">
          {panel}
        </TabsContent>
      </Tabs>

      {summary && (
        <div
          role="group"
          aria-label={`${RANGE_NAME[range]} summary`}
          className="grid grid-cols-2 border-t border-primary md:grid-cols-5 md:border-b"
        >
          <dl className="contents">
            <SummaryCell label="Start">
              <Price value={summary.first} />
            </SummaryCell>
            <SummaryCell label="Latest">
              <Price value={summary.last} />
            </SummaryCell>
            <SummaryCell label="High">
              <Price value={summary.high} />
            </SummaryCell>
            <SummaryCell label="Low">
              <Price value={summary.low} />
            </SummaryCell>
            <SummaryCell label="Change">
              <PercentChange value={summary.change} className="text-mono-sm" />
            </SummaryCell>
          </dl>
        </div>
      )}
    </section>
  );
}
