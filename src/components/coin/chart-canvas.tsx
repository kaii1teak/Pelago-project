"use client";

import {
  CandlestickSeries,
  LineSeries,
  createChart,
  type BarData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { Candle, LinePoint } from "@/lib/chart-data";
import { priceMinMove } from "@/lib/chart-data";
import type { ChartMode, ChartRange } from "@/lib/chart";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { chartOptions } from "./chart-options";
import { readChartTheme, type ChartTheme } from "./chart-theme";

/** What's under the crosshair, in the app's own terms (not the library's). */
export type CrosshairInfo = {
  time: number;
  value?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
};

const asTime = (seconds: number) => seconds as UTCTimestamp;

// The crosshair payload is a union that includes a generic CustomData type, so
// plain `in` checks don't narrow. These do.
const isLineData = (d: object): d is LineData<Time> => "value" in d;
const isBarData = (d: object): d is BarData<Time> => "open" in d && "close" in d;

const lineOptions = (theme: ChartTheme) => ({
  color: theme.text,
  lineWidth: 2 as const,
  lastValueVisible: false,
  priceLineVisible: false,
  crosshairMarkerRadius: 4,
  crosshairMarkerBorderColor: theme.background,
  crosshairMarkerBackgroundColor: theme.text,
});

const candleOptions = (theme: ChartTheme) => ({
  upColor: theme.up,
  downColor: theme.down,
  wickUpColor: theme.up,
  wickDownColor: theme.down,
  borderVisible: false,
  lastValueVisible: false,
  priceLineVisible: false,
});

type AnySeries = ISeriesApi<"Line"> | ISeriesApi<"Candlestick">;

export default function ChartCanvas({
  mode,
  line,
  candles,
  range,
  onCrosshair,
  className,
}: {
  mode: ChartMode;
  line: readonly LinePoint[];
  candles: readonly Candle[];
  range: ChartRange;
  onCrosshair: (info: CrosshairInfo | null) => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<AnySeries | null>(null);
  const seriesModeRef = useRef<ChartMode | null>(null);

  // Latest props for callbacks created once (the chart's own event handlers).
  const latest = useRef({ mode, range, onCrosshair });
  useEffect(() => {
    latest.current = { mode, range, onCrosshair };
  });

  // 1. Create the chart once; tear it down on unmount.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(
      host,
      chartOptions(readChartTheme(host), latest.current.range),
    );
    chartRef.current = chart;

    const onMove = (param: MouseEventParams<Time>) => {
      const series = seriesRef.current;
      const item = series ? param.seriesData.get(series) : undefined;
      if (!param.point || param.time === undefined || !item) {
        latest.current.onCrosshair(null);
        return;
      }
      const time = Number(param.time);
      if (isLineData(item)) latest.current.onCrosshair({ time, value: item.value });
      else if (isBarData(item)) {
        latest.current.onCrosshair({
          time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        });
      }
    };
    chart.subscribeCrosshairMove(onMove);

    // Canvas colors can't follow CSS, so re-resolve the tokens when the theme flips.
    const themeObserver = new MutationObserver(() => {
      const theme = readChartTheme(host);
      chart.applyOptions(chartOptions(theme, latest.current.range));
      seriesRef.current?.applyOptions(
        latest.current.mode === "line" ? lineOptions(theme) : candleOptions(theme),
      );
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
      seriesRef.current = null;
      seriesModeRef.current = null;
    };
  }, []);

  // 2. Series type + data.
  useEffect(() => {
    const chart = chartRef.current;
    const host = hostRef.current;
    if (!chart || !host) return;
    const theme = readChartTheme(host);

    if (seriesModeRef.current !== mode) {
      if (seriesRef.current) chart.removeSeries(seriesRef.current);
      seriesRef.current =
        mode === "line"
          ? chart.addSeries(LineSeries, lineOptions(theme))
          : chart.addSeries(CandlestickSeries, candleOptions(theme));
      seriesModeRef.current = mode;
      latest.current.onCrosshair(null);
    }
    const series = seriesRef.current;
    if (!series) return;

    const latestPrice = mode === "line" ? line.at(-1)?.value : candles.at(-1)?.close;
    series.applyOptions({
      priceFormat: {
        type: "custom",
        minMove: priceMinMove(latestPrice ?? 1),
        formatter: (price: number) => formatUsd(price),
      },
    });

    if (mode === "line") {
      (series as ISeriesApi<"Line">).setData(
        line.map((p) => ({ time: asTime(p.time), value: p.value })),
      );
    } else {
      (series as ISeriesApi<"Candlestick">).setData(
        candles.map((c) => ({
          time: asTime(c.time),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
    }
    chart.timeScale().fitContent();
  }, [mode, line, candles]);

  // 3. Time formatting follows the range.
  useEffect(() => {
    const chart = chartRef.current;
    const host = hostRef.current;
    if (chart && host) chart.applyOptions(chartOptions(readChartTheme(host), range));
  }, [range]);

  return <div ref={hostRef} className={cn("size-full", className)} />;
}
