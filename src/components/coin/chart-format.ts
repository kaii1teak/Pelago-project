import type { ChartRange } from "@/lib/chart";

/**
 * Whose clock and language a time is written in. Left out, it is the viewer's own: right for
 * the chart, which only ever draws in the browser. The chart's legend, though, is in the
 * server's HTML too, and the server knows neither the viewer's time zone nor their locale.
 * See useViewerTime for how that is kept from becoming a hydration mismatch.
 */
export type Viewer = { locale?: string; timeZone?: string };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(kind: "dayTime" | "dayOnly", viewer: Viewer) {
  const key = `${kind}|${viewer.locale ?? ""}|${viewer.timeZone ?? ""}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(
      viewer.locale,
      kind === "dayTime"
        ? {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: viewer.timeZone,
          }
        : { month: "short", day: "numeric", year: "numeric", timeZone: viewer.timeZone },
    );
    formatters.set(key, format);
  }
  return format;
}

/** Timestamp label for the crosshair and legend. A year of daily data has no useful time of day. */
export function formatChartTime(range: ChartRange, seconds: number, viewer: Viewer = {}) {
  return formatterFor(range === "1y" ? "dayOnly" : "dayTime", viewer).format(
    new Date(seconds * 1000),
  );
}
