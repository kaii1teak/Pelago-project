"use client";

import {
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { chartOptions } from "@/components/coin/chart-options";
import {
  readChartTheme,
  readSeriesColors,
  type ChartTheme,
} from "@/components/coin/chart-theme";
import type { ChartRange } from "@/lib/chart";
import type { LinePoint } from "@/lib/chart-data";
import type { CompareView } from "@/lib/compare";
import { formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One line on the chart: percent change since the shared start, or the price (see `view`). */
export type CompareSeries = {
  id: string;
  /** Its line color: an index into COMPARE_PALETTE. */
  color: number;
  points: readonly LinePoint[];
};

/** What's under the crosshair: the time, and each asset's value there (percent or price). */
export type CompareCrosshair = { time: number; values: Record<string, number> };

const asTime = (seconds: number) => seconds as UTCTimestamp;
const isLineData = (d: object): d is LineData<Time> => "value" in d;

type Entry = { api: ISeriesApi<"Line">; color: number };

const seriesOptions = (theme: ChartTheme, color: string, view: CompareView) => ({
  color,
  lineWidth: 2 as const,
  lastValueVisible: false,
  priceLineVisible: false,
  crosshairMarkerRadius: 4,
  crosshairMarkerBackgroundColor: color,
  crosshairMarkerBorderColor: theme.background,
  priceFormat: {
    type: "custom" as const,
    // Prices span cents to tens of thousands of dollars: no single step suits them all.
    minMove: view === "price" ? 1e-8 : 0.01,
    formatter: (value: number) =>
      view === "price" ? formatUsd(value) : formatPercent(value),
  },
});

/**
 * The shared options, with the axis in percent or in dollars. Prices go on a
 * LOGARITHMIC axis: coins that cost $80,000 and $0.10 could not share a linear one,
 * and on a log axis an equal percentage move is an equal distance, which is what
 * a comparison is for.
 */
const compareOptions = (theme: ChartTheme, range: ChartRange, view: CompareView) => {
  const base = chartOptions(theme, range);
  return {
    ...base,
    rightPriceScale: {
      ...base.rightPriceScale,
      mode: view === "price" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    },
    localization: {
      ...base.localization,
      priceFormatter: (value: number) =>
        view === "price" ? formatUsd(value) : formatPercent(value, 1),
    },
  };
};

/** The 0% line every series starts from. */
const baselineOptions = (theme: ChartTheme) => ({
  price: 0,
  color: theme.gridStrong,
  lineWidth: 1 as const,
  lineStyle: LineStyle.Dotted,
  axisLabelVisible: false,
});

export default function CompareCanvas({
  series,
  range,
  view = "change",
  onCrosshair,
  className,
}: {
  series: readonly CompareSeries[];
  range: ChartRange;
  view?: CompareView;
  onCrosshair: (info: CompareCrosshair | null) => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const entries = useRef(new Map<string, Entry>());
  const baseline = useRef<{ api: ISeriesApi<"Line">; line: IPriceLine } | null>(null);
  const shownView = useRef(view);

  // Latest props for callbacks created once (the chart's own event handlers).
  const latest = useRef({ range, view, onCrosshair });
  useEffect(() => {
    latest.current = { range, view, onCrosshair };
  });

  // 1. Create the chart once; tear it down on unmount.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(
      host,
      compareOptions(readChartTheme(host), latest.current.range, latest.current.view),
    );
    chartRef.current = chart;
    const map = entries.current;

    const onMove = (param: MouseEventParams<Time>) => {
      if (!param.point || param.time === undefined) {
        latest.current.onCrosshair(null);
        return;
      }
      const values: Record<string, number> = {};
      for (const [id, { api }] of map) {
        const item = param.seriesData.get(api);
        if (item && isLineData(item)) values[id] = item.value;
      }
      latest.current.onCrosshair({ time: Number(param.time), values });
    };
    chart.subscribeCrosshairMove(onMove);

    // Canvas colors can't follow CSS, so re-resolve the tokens when the theme flips.
    const themeObserver = new MutationObserver(() => {
      const theme = readChartTheme(host);
      const colors = readSeriesColors(host);
      const { range, view } = latest.current;
      chart.applyOptions(compareOptions(theme, range, view));
      for (const { api, color } of map.values()) {
        api.applyOptions(seriesOptions(theme, colors[color] ?? colors[0]!, view));
      }
      if (baseline.current) {
        baseline.current.line.applyOptions(baselineOptions(theme));
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      themeObserver.disconnect();
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      map.clear();
      baseline.current = null;
    };
  }, []);

  // 2. One line per asset: add the new, drop the removed, refresh the data.
  useEffect(() => {
    const chart = chartRef.current;
    const host = hostRef.current;
    if (!chart || !host) return;
    const map = entries.current;
    const theme = readChartTheme(host);
    const colors = readSeriesColors(host);
    const wanted = new Set(series.map((s) => s.id));
    const viewChanged = shownView.current !== view;
    shownView.current = view;

    for (const [id, entry] of map) {
      if (wanted.has(id)) continue;
      // Removing a series also removes the baseline if it was hanging on it.
      if (baseline.current?.api === entry.api) baseline.current = null;
      chart.removeSeries(entry.api);
      map.delete(id);
    }

    for (const s of series) {
      const color = colors[s.color] ?? colors[0]!;
      let entry = map.get(s.id);
      if (!entry) {
        entry = {
          api: chart.addSeries(LineSeries, seriesOptions(theme, color, view)),
          color: s.color,
        };
        map.set(s.id, entry);
      } else if (entry.color !== s.color || viewChanged) {
        entry.api.applyOptions(seriesOptions(theme, color, view));
        entry.color = s.color;
      }
      entry.api.setData(s.points.map((p) => ({ time: asTime(p.time), value: p.value })));
    }

    // The 0% reference hangs on the first line (and only means something for percent
    // change); move it if that line changed, drop it in the price view.
    const first = view === "change" && series[0] ? map.get(series[0].id) : undefined;
    if (baseline.current && baseline.current.api !== first?.api) {
      baseline.current.api.removePriceLine(baseline.current.line);
      baseline.current = null;
    }
    if (first && !baseline.current) {
      baseline.current = {
        api: first.api,
        line: first.api.createPriceLine(baselineOptions(theme)),
      };
    }

    latest.current.onCrosshair(null);
    chart.timeScale().fitContent();
  }, [series, view]);

  // 3. Time formatting follows the range.
  useEffect(() => {
    const chart = chartRef.current;
    const host = hostRef.current;
    if (!chart || !host) return;
    chart.applyOptions(compareOptions(readChartTheme(host), range, view));
  }, [range, view]);

  return <div ref={hostRef} className={cn("size-full", className)} />;
}
