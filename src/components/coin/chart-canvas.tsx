"use client";

import {
  CandlestickSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
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
import { liveLinePoint, nextLiveCandle, priceMinMove } from "@/lib/chart-data";
import {
  CHART_DAYS,
  type ChartMode,
  type ChartRange,
  type ChartScale,
} from "@/lib/chart";
import { ZOOM_STEP, isNearStart, zoomLogicalRange } from "@/lib/chart-zoom";
import { fadeIn } from "@/lib/fade";
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

/** What the page can ask the chart to do (the zoom buttons). */
export type ChartControls = { zoomIn: () => void; zoomOut: () => void };

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
  // The 0% line of the percent axis: the library's default is its own gray-blue.
  baseLineColor: theme.gridStrong,
  baseLineStyle: LineStyle.Dotted,
});

// A light and a dark body (see --candle-* in globals.css), outlined so either one
// reads on both themes. Direction is told by lightness, not by red/green.
const candleOptions = (theme: ChartTheme) => ({
  upColor: theme.candleUp,
  downColor: theme.candleDown,
  borderUpColor: theme.candleUpLine,
  borderDownColor: theme.candleDownLine,
  wickUpColor: theme.candleUpLine,
  wickDownColor: theme.candleDownLine,
  borderVisible: true,
  lastValueVisible: false,
  priceLineVisible: false,
});

type AnySeries = ISeriesApi<"Line"> | ISeriesApi<"Candlestick">;

/** Mouse-wheel notches are noisy: no single event may zoom by more than this. */
const WHEEL_ZOOM = { min: 0.8, max: 1.25 };

export default function ChartCanvas({
  mode,
  line,
  candles,
  range,
  onCrosshair,
  className,
  scale = "price",
  hasMore = false,
  onNearStart,
  resetKey = 0,
  controlsRef,
  live = null,
}: {
  mode: ChartMode;
  line: readonly LinePoint[];
  candles: readonly Candle[];
  range: ChartRange;
  onCrosshair: (info: CrosshairInfo | null) => void;
  className?: string;
  scale?: ChartScale;
  /** More history exists before the first bar: scrolling may go past it, and `onNearStart` fires. */
  hasMore?: boolean;
  /** The user has scrolled to (almost) the start of what is loaded: fetch older data. */
  onNearStart?: () => void;
  /** Bump to jump back to the latest window of the timeframe. */
  resetKey?: number;
  controlsRef?: React.RefObject<ChartControls | null>;
  /** The live feed's price (and the high and low of its current minute): the end of the chart follows it. */
  live?: { price: number; high?: number; low?: number } | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<AnySeries | null>(null);
  const seriesModeRef = useRef<ChartMode | null>(null);
  /** What the series currently holds, to tell "older data was added" from "a new chart". */
  const loaded = useRef<{ first: number; key: string } | null>(null);
  /** The user has dragged, zoomed or scrolled: only then may reaching the start load more. */
  const interacted = useRef(false);
  /** The candle being built from live prices, and the history it was built on. */
  const liveBar = useRef<{ base: readonly Candle[]; bar: Candle | null }>({
    base: [],
    bar: null,
  });

  // Latest props for callbacks created once (the chart's own event handlers).
  const latest = useRef({ mode, range, onCrosshair, hasMore, onNearStart, line });
  useEffect(() => {
    latest.current = { mode, range, onCrosshair, hasMore, onNearStart, line };
  });

  // 1. Create the chart once; tear it down on unmount.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(
      host,
      chartOptions(readChartTheme(host), latest.current.range, !latest.current.hasMore),
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

    // Scrolling back in time: once the view nears the first bar, ask for older data.
    const onRange = (visible: { from: number; to: number } | null) => {
      if (!visible || !interacted.current || !latest.current.hasMore) return;
      if (isNearStart(visible)) latest.current.onNearStart?.();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

    const zoomBy = (factor: number, anchor = 0.5) => {
      const view = chart.timeScale().getVisibleLogicalRange();
      if (!view) return;
      interacted.current = true;
      chart.timeScale().setVisibleLogicalRange(zoomLogicalRange(view, factor, anchor));
    };
    if (controlsRef) {
      controlsRef.current = {
        zoomIn: () => zoomBy(ZOOM_STEP),
        zoomOut: () => zoomBy(1 / ZOOM_STEP),
      };
    }

    // Any touch of the chart counts: from then on, reaching the start loads more.
    const markInteracted = () => {
      interacted.current = true;
    };
    host.addEventListener("pointerdown", markInteracted);

    // The page scrolls, so the wheel is the page's: vertical scrolling over the chart
    // moves the page. Two gestures are the chart's: Ctrl/Cmd + wheel (and a trackpad
    // pinch, which browsers send as ctrl+wheel) zooms; a sideways swipe pans.
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const box = host.getBoundingClientRect();
        const anchor =
          box.width > 0
            ? Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
            : 0.5;
        const factor = Math.exp(event.deltaY * 0.01);
        zoomBy(Math.min(WHEEL_ZOOM.max, Math.max(WHEEL_ZOOM.min, factor)), anchor);
      } else if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        interacted.current = true;
        const timeScale = chart.timeScale();
        const spacing = timeScale.options().barSpacing;
        timeScale.scrollToPosition(
          timeScale.scrollPosition() - event.deltaX / spacing,
          false,
        );
      }
    };
    host.addEventListener("wheel", onWheel, { passive: false });

    // Canvas colors can't follow CSS, so re-resolve the tokens when the theme flips.
    const themeObserver = new MutationObserver(() => {
      const theme = readChartTheme(host);
      chart.applyOptions(
        chartOptions(theme, latest.current.range, !latest.current.hasMore),
      );
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
      host.removeEventListener("pointerdown", markInteracted);
      host.removeEventListener("wheel", onWheel);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      chart.unsubscribeCrosshairMove(onMove);
      if (controlsRef) controlsRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      seriesModeRef.current = null;
      loaded.current = null;
    };
    // controlsRef is a stable ref object from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Series type + data.
  useEffect(() => {
    const chart = chartRef.current;
    const host = hostRef.current;
    if (!chart || !host) return;
    const theme = readChartTheme(host);

    let switched = false;
    if (seriesModeRef.current !== mode) {
      switched = true;
      if (seriesRef.current) chart.removeSeries(seriesRef.current);
      seriesRef.current =
        mode === "line"
          ? chart.addSeries(LineSeries, lineOptions(theme))
          : chart.addSeries(CandlestickSeries, candleOptions(theme));
      seriesModeRef.current = mode;
      loaded.current = null;
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

    const bars = mode === "line" ? line : candles;
    const first = bars[0]?.time;
    const last = bars.at(-1)?.time;
    // A new chart (other timeframe, a reset, or another series type) starts at the
    // latest window. Older data being ADDED must instead leave the view where it is,
    // and a live refresh of the same data must not disturb a view the user moved.
    const key = `${mode}:${range}:${resetKey}`;
    const before = loaded.current;
    const prepended = before?.key === key && first !== undefined && first < before.first;
    const refreshed = before?.key === key && !prepended;
    const view = prepended ? chart.timeScale().getVisibleRange() : null;

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

    if (prepended && view) {
      chart.timeScale().setVisibleRange(view);
    } else if (!refreshed) {
      interacted.current = false;
      // A different range, type or reset is a new picture: let it arrive instead of snapping.
      if (before || switched) fadeIn(host);
      const window = CHART_DAYS[range] * 86_400;
      if (
        mode === "line" &&
        first !== undefined &&
        last !== undefined &&
        last - first > window * 1.02
      ) {
        // Older history is loaded too: show just the timeframe's latest window.
        chart
          .timeScale()
          .setVisibleRange({ from: asTime(last - window), to: asTime(last) });
      } else {
        chart.timeScale().fitContent();
      }
    }
    if (first !== undefined) loaded.current = { first, key };
  }, [mode, line, candles, range, resetKey]);

  // 3. The live price: the last point of the line, or the last candle, follows the feed. It is
  // applied again whenever the history is replaced (a poll, older data), which would otherwise
  // set the end of the chart back to a minutes-old price for a second.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !live) return;
    if (mode === "line") {
      const point = liveLinePoint(line, live);
      if (point) {
        (series as ISeriesApi<"Line">).update({
          time: asTime(point.time),
          value: point.value,
        });
      }
      return;
    }
    if (liveBar.current.base !== candles) liveBar.current = { base: candles, bar: null };
    const bar = nextLiveCandle(candles, liveBar.current.bar, {
      ...live,
      time: Math.floor(Date.now() / 1000),
    });
    if (!bar) return;
    liveBar.current.bar = bar;
    (series as ISeriesApi<"Candlestick">).update({
      time: asTime(bar.time),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    });
  }, [live, mode, line, candles]);

  // 4. Time formatting follows the range; the left edge is free while there is more history.
  useEffect(() => {
    const chart = chartRef.current;
    const host = hostRef.current;
    if (chart && host)
      chart.applyOptions(chartOptions(readChartTheme(host), range, !hasMore));
  }, [range, hasMore]);

  // 5. Price axis in dollars, or as percent change from the first bar on screen.
  useEffect(() => {
    chartRef.current?.priceScale("right").applyOptions({
      mode:
        scale === "percent" && mode === "line"
          ? PriceScaleMode.Percentage
          : PriceScaleMode.Normal,
    });
  }, [scale, mode]);

  return <div ref={hostRef} className={cn("size-full", className)} />;
}
