"use client";

import {
  LineSeries,
  LineStyle,
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
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One line on the chart: percent change since the shared start. */
export type CompareSeries = {
  id: string;
  /** Which palette color it takes (see COMPARE_COLOR_TOKENS). */
  slot: number;
  points: readonly LinePoint[];
};

/** What's under the crosshair: the time, and each asset's percent change there. */
export type CompareCrosshair = { time: number; values: Record<string, number> };

const asTime = (seconds: number) => seconds as UTCTimestamp;
const isLineData = (d: object): d is LineData<Time> => "value" in d;

type Entry = { api: ISeriesApi<"Line">; slot: number };

const seriesOptions = (theme: ChartTheme, color: string) => ({
  color,
  lineWidth: 2 as const,
  lastValueVisible: false,
  priceLineVisible: false,
  crosshairMarkerRadius: 4,
  crosshairMarkerBackgroundColor: color,
  crosshairMarkerBorderColor: theme.background,
  priceFormat: {
    type: "custom" as const,
    minMove: 0.01,
    formatter: (value: number) => formatPercent(value),
  },
});

/** The shared options, with the price axis and crosshair label in percent, not dollars. */
const compareOptions = (theme: ChartTheme, range: ChartRange) => {
  const base = chartOptions(theme, range);
  return {
    ...base,
    localization: {
      ...base.localization,
      priceFormatter: (value: number) => formatPercent(value, 1),
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
  onCrosshair,
  className,
}: {
  series: readonly CompareSeries[];
  range: ChartRange;
  onCrosshair: (info: CompareCrosshair | null) => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const entries = useRef(new Map<string, Entry>());
  const baseline = useRef<{ api: ISeriesApi<"Line">; line: IPriceLine } | null>(null);

  // Latest props for callbacks created once (the chart's own event handlers).
  const latest = useRef({ range, onCrosshair });
  useEffect(() => {
    latest.current = { range, onCrosshair };
  });

  // 1. Create the chart once; tear it down on unmount.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(
      host,
      compareOptions(readChartTheme(host), latest.current.range),
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
      chart.applyOptions(compareOptions(theme, latest.current.range));
      for (const { api, slot } of map.values()) {
        api.applyOptions(seriesOptions(theme, colors[slot % colors.length]!));
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

    for (const [id, entry] of map) {
      if (wanted.has(id)) continue;
      // Removing a series also removes the baseline if it was hanging on it.
      if (baseline.current?.api === entry.api) baseline.current = null;
      chart.removeSeries(entry.api);
      map.delete(id);
    }

    for (const s of series) {
      const color = colors[s.slot % colors.length]!;
      let entry = map.get(s.id);
      if (!entry) {
        entry = {
          api: chart.addSeries(LineSeries, seriesOptions(theme, color)),
          slot: s.slot,
        };
        map.set(s.id, entry);
      } else if (entry.slot !== s.slot) {
        entry.api.applyOptions(seriesOptions(theme, color));
        entry.slot = s.slot;
      }
      entry.api.setData(s.points.map((p) => ({ time: asTime(p.time), value: p.value })));
    }

    // The 0% reference hangs on the first line; move it if that line changed.
    const first = series[0] ? map.get(series[0].id) : undefined;
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
  }, [series]);

  // 3. Time formatting follows the range.
  useEffect(() => {
    const chart = chartRef.current;
    const host = hostRef.current;
    if (!chart || !host) return;
    chart.applyOptions(compareOptions(readChartTheme(host), range));
  }, [range]);

  return <div ref={hostRef} className={cn("size-full", className)} />;
}
