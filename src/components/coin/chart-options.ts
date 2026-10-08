import {
  ColorType,
  CrosshairMode,
  LineStyle,
  TickMarkType,
  type ChartOptions,
  type DeepPartial,
  type Time,
} from "lightweight-charts";
import type { ChartRange } from "@/lib/chart";
import { formatChartTime } from "./chart-format";
import type { ChartTheme } from "./chart-theme";

/**
 * Options shared by every chart in the app (the asset chart and the comparison),
 * so they look and behave alike: flat hairline grid, mono labels, and a chart that
 * never captures the page's scrolling.
 */

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

export function chartOptions(
  theme: ChartTheme,
  range: ChartRange,
  /** Stop scrolling at the first bar. Off while there is older history still to load. */
  fixLeftEdge = true,
): DeepPartial<ChartOptions> {
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
      fixLeftEdge,
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
