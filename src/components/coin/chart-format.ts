import type { ChartRange } from "@/lib/chart";

// Client-only (the chart never renders on the server), so the viewer's own
// locale and time zone are the right choice here.
const dayTime = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dayOnly = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Timestamp label for the crosshair and legend. A year of daily data has no useful time of day. */
export function formatChartTime(range: ChartRange, seconds: number) {
  return (range === "1y" ? dayOnly : dayTime).format(new Date(seconds * 1000));
}
