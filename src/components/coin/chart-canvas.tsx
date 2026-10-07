"use client";

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  TickMarkType,
  createChart,
  type BarData,
  type ChartOptions,
  type DeepPartial,
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
import { formatChartTime } from "./chart-format";
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

// The chart is client-only, so these use the viewer's own locale and time zone.
const clock = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const monthDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const monthOnly = new Intl.DateTimeFormat(undefined, { month: "short" });
const yearOnly = new Intl.DateTimeFormat(undefined, { year: "numeric" });

const toDate = (time: Time) => new Date(Number(time) * 1000);

function formatTick(time: Time, type: TickMarkType) {
  const date = toDate(time);
  switch (type) {
    case TickMarkType.Year:
      return yearOnly.format(date);
    case TickMarkType.Month:
      return monthOnly.format(date);
    case TickMarkType.DayOfMonth:
      return monthDay.format(date);
    default:
      return clock.format(date);
  }
}

function chartOptions(theme: ChartTheme, range: ChartRange): DeepPartial<ChartOptions> {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: theme.background },
      textColor: theme.muted,
      fontFamily: theme.fontFamily,
      fontSize: 12,
      // TradingView's license asks for a link back; the default logo satisfies it.
      attributionLogo: true,
    },
    // Hairline grid in the same color as every other divider in the app.
    grid: {
      vertLines: { color: theme.grid },
      horzLines: { color: theme.grid },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: theme.gridStrong,
        width: 1,
        style: LineStyle.Dashed,
        labelBackgroundColor: theme.inverse,
      },
      horzLine: {
        color: theme.gridStrong,
        width: 1,
        style: LineStyle.Dashed,
        labelBackgroundColor: theme.inverse,
      },
    },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
    timeScale: {
      borderColor: theme.grid,
      timeVisible: range !== "1y",
      secondsVisible: false,
      rightOffset: 2,
      fixLeftEdge: true,
      fixRightEdge: true,
      tickMarkFormatter: (time: Time, type: TickMarkType) => formatTick(time, type),
    },
    localization: { timeFormatter: (time: Time) => formatChartTime(range, Number(time)) },
    // The page scrolls, so the chart must not capture the wheel or a vertical
    // swipe, or it becomes a trap on desktop and on phones. Pan with drag; pinch to zoom.
    handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true },
    handleScroll: {
      mouseWheel: false,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
  };
}

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
