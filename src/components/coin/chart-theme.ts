import { COMPARE_COLOR_TOKENS } from "@/lib/compare";

/**
 * Lightweight Charts paints to a canvas, so it needs concrete color strings,
 * not CSS variables. These are resolved from the live design tokens (so they
 * follow the theme and nothing is hardcoded here), then re-resolved when the
 * theme is toggled.
 */
export type ChartTheme = {
  background: string;
  text: string;
  muted: string;
  grid: string;
  gridStrong: string;
  inverse: string;
  inverseText: string;
  candleUp: string;
  candleUpLine: string;
  candleDown: string;
  candleDownLine: string;
  fontFamily: string;
};

/** Resolve a CSS variable to the browser's computed `rgb()/rgba()` string. */
function resolveColor(host: HTMLElement, cssVar: string) {
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = `var(${cssVar})`;
  host.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

export function readChartTheme(host: HTMLElement): ChartTheme {
  const font = document.createElement("span");
  font.className = "num"; // the mono face used for every figure in the app
  font.style.display = "none";
  host.appendChild(font);
  const fontFamily = getComputedStyle(font).fontFamily;
  font.remove();

  return {
    background: resolveColor(host, "--bg-primary"),
    text: resolveColor(host, "--text-primary"),
    muted: resolveColor(host, "--text-muted"),
    grid: resolveColor(host, "--border-primary"),
    gridStrong: resolveColor(host, "--border-strong"),
    inverse: resolveColor(host, "--bg-inverse"),
    inverseText: resolveColor(host, "--text-inverse"),
    candleUp: resolveColor(host, "--candle-up"),
    candleUpLine: resolveColor(host, "--candle-up-line"),
    candleDown: resolveColor(host, "--candle-down"),
    candleDownLine: resolveColor(host, "--candle-down-line"),
    fontFamily,
  };
}

/** The comparison's series colors, one per slot, resolved from the live theme. */
export function readSeriesColors(host: HTMLElement): string[] {
  return COMPARE_COLOR_TOKENS.map((token) => resolveColor(host, token));
}
