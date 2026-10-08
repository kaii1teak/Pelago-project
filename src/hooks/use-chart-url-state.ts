"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  DEFAULT_MODE,
  DEFAULT_RANGE,
  DEFAULT_SCALE,
  isChartMode,
  isChartRange,
  isChartScale,
  type ChartMode,
  type ChartRange,
  type ChartScale,
} from "@/lib/chart";

/**
 * Range, chart type and axis scale live in the URL (?range=30d&mode=candle&scale=percent)
 * so a link reproduces the exact chart. Updates use the native History API, which Next
 * integrates with useSearchParams: an instant, client-only change with no
 * server round-trip. (Same approach as the Markets table.)
 */
export function useChartUrlState() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const state = useMemo(() => {
    const range = searchParams.get("range");
    const mode = searchParams.get("mode");
    const scale = searchParams.get("scale");
    return {
      range: isChartRange(range) ? range : DEFAULT_RANGE,
      mode: isChartMode(mode) ? mode : DEFAULT_MODE,
      scale: isChartScale(scale) ? scale : DEFAULT_SCALE,
    };
  }, [searchParams]);

  const update = useCallback(
    (patch: { range?: ChartRange; mode?: ChartMode; scale?: ChartScale }) => {
      // Read the live URL, not a stale closure, so two quick updates compose.
      const params = new URLSearchParams(window.location.search);
      const range =
        patch.range ??
        (isChartRange(params.get("range"))
          ? (params.get("range") as ChartRange)
          : DEFAULT_RANGE);
      const mode =
        patch.mode ??
        (isChartMode(params.get("mode"))
          ? (params.get("mode") as ChartMode)
          : DEFAULT_MODE);

      const scale =
        patch.scale ??
        (isChartScale(params.get("scale"))
          ? (params.get("scale") as ChartScale)
          : DEFAULT_SCALE);

      // Always written in the same order, so one state is always one URL
      // (other params, if any, keep their place ahead of these three).
      params.delete("range");
      params.delete("mode");
      params.delete("scale");
      if (range !== DEFAULT_RANGE) params.set("range", range);
      if (mode !== DEFAULT_MODE) params.set("mode", mode);
      if (scale !== DEFAULT_SCALE) params.set("scale", scale);

      // Commas are legal in a query string and much more readable than %2C
      // (other pages put lists there, e.g. ?assets=bitcoin,ethereum).
      const search = params.toString().replaceAll("%2C", ",");
      const url = search ? `${pathname}?${search}` : pathname;
      if (url === `${window.location.pathname}${window.location.search}`) return;
      window.history.replaceState(null, "", url);
    },
    [pathname],
  );

  return {
    ...state,
    setRange: useCallback((range: ChartRange) => update({ range }), [update]),
    setMode: useCallback((mode: ChartMode) => update({ mode }), [update]),
    setScale: useCallback((scale: ChartScale) => update({ scale }), [update]),
  };
}
