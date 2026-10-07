import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChartCanvas, { type CrosshairInfo } from "./chart-canvas";

// A recording stand-in for the charting library: we assert how it's *driven*.
const lib = vi.hoisted(() => {
  const state = {
    chart: null as ReturnType<typeof makeChart> | null,
    series: [] as {
      kind: string;
      options: Record<string, unknown>;
      api: ReturnType<typeof makeSeries>;
    }[],
    crosshairHandlers: [] as ((param: unknown) => void)[],
    createChart: undefined as unknown as ReturnType<typeof vi.fn>,
  };
  function makeSeries() {
    return { setData: vi.fn(), applyOptions: vi.fn() };
  }
  function makeChart() {
    const fitContent = vi.fn();
    return {
      fitContent,
      addSeries: vi.fn((def: { kind: string }, options: Record<string, unknown>) => {
        const api = makeSeries();
        state.series.push({ kind: def.kind, options, api });
        return api;
      }),
      removeSeries: vi.fn(),
      timeScale: () => ({ fitContent }),
      subscribeCrosshairMove: vi.fn((h: (p: unknown) => void) =>
        state.crosshairHandlers.push(h),
      ),
      unsubscribeCrosshairMove: vi.fn(),
      applyOptions: vi.fn(),
      remove: vi.fn(),
    };
  }
  state.createChart = vi.fn(() => (state.chart = makeChart()));
  return { state, makeChart };
});

vi.mock("lightweight-charts", () => ({
  createChart: lib.state.createChart,
  LineSeries: { kind: "Line" },
  CandlestickSeries: { kind: "Candlestick" },
  ColorType: { Solid: "solid" },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Dashed: 2 },
  TickMarkType: { Year: 0, Month: 1, DayOfMonth: 2, Time: 3, TimeWithSeconds: 4 },
}));

// jsdom has no stylesheet, so resolve tokens from a controllable theme instead.
const theme = vi.hoisted(() => ({
  current: {
    background: "BG",
    text: "TEXT",
    muted: "MUTED",
    grid: "GRID",
    gridStrong: "GRIDSTRONG",
    inverse: "INVERSE",
    inverseText: "INVERSETEXT",
    up: "UP",
    down: "DOWN",
    fontFamily: "MONO",
  },
}));
vi.mock("./chart-theme", () => ({ readChartTheme: () => ({ ...theme.current }) }));

const line = [
  { time: 100, value: 10 },
  { time: 200, value: 12 },
];
const candles = [
  { time: 100, open: 10, high: 14, low: 9, close: 12 },
  { time: 200, open: 12, high: 15, low: 11, close: 11.5 },
];

// The slice of the options object these tests read back from the stand-in.
type CapturedOptions = {
  autoSize: boolean;
  layout: {
    textColor: string;
    fontFamily: string;
    attributionLogo: boolean;
    background: { color: string };
  };
  grid: { horzLines: { color: string }; vertLines: { color: string } };
  handleScale: { mouseWheel: boolean; pinch: boolean };
  handleScroll: {
    mouseWheel: boolean;
    vertTouchDrag: boolean;
    pressedMouseMove: boolean;
  };
  timeScale: {
    timeVisible: boolean;
    tickMarkFormatter: (time: number, type: number) => string;
  };
  localization: { timeFormatter: (time: number) => string };
};
type CapturedPriceFormat = {
  type: string;
  minMove: number;
  formatter: (price: number) => string;
};

const setup = (props: Partial<React.ComponentProps<typeof ChartCanvas>> = {}) => {
  const onCrosshair = vi.fn<(info: CrosshairInfo | null) => void>();
  const utils = render(
    <ChartCanvas
      mode="line"
      line={line}
      candles={[]}
      range="7d"
      onCrosshair={onCrosshair}
      {...props}
    />,
  );
  return { onCrosshair, ...utils };
};

beforeEach(() => {
  lib.state.series.length = 0;
  lib.state.crosshairHandlers.length = 0;
  lib.state.createChart.mockClear();
  lib.state.chart = null;
  theme.current = { ...theme.current, text: "TEXT", background: "BG" };
  document.documentElement.classList.remove("dark");
});

describe("ChartCanvas: setup", () => {
  it("creates the chart once, flat and theme-colored", () => {
    setup();
    expect(lib.state.createChart).toHaveBeenCalledTimes(1);
    const options = lib.state.createChart.mock.calls[0]![1] as CapturedOptions;
    expect(options.autoSize).toBe(true);
    expect(options.layout).toMatchObject({
      textColor: "MUTED",
      fontFamily: "MONO",
      attributionLogo: true,
    });
    expect(options.layout.background.color).toBe("BG");
    // Hairline grid in the divider color, nothing decorative.
    expect(options.grid.horzLines.color).toBe("GRID");
    expect(options.grid.vertLines.color).toBe("GRID");
  });

  it("never captures the page's scrolling (wheel and vertical touch)", () => {
    setup();
    const options = lib.state.createChart.mock.calls[0]![1] as CapturedOptions;
    expect(options.handleScale.mouseWheel).toBe(false);
    expect(options.handleScroll.mouseWheel).toBe(false);
    expect(options.handleScroll.vertTouchDrag).toBe(false);
    // ...while drag-to-pan and pinch still work.
    expect(options.handleScroll.pressedMouseMove).toBe(true);
    expect(options.handleScale.pinch).toBe(true);
  });

  it("keeps TradingView's attribution (their license asks for the link)", () => {
    setup();
    const options = lib.state.createChart.mock.calls[0]![1] as CapturedOptions;
    expect(options.layout.attributionLogo).toBe(true);
  });

  it("removes the chart and unsubscribes on unmount", () => {
    const { unmount } = setup();
    const chart = lib.state.chart!;
    unmount();
    expect(chart.unsubscribeCrosshairMove).toHaveBeenCalledTimes(1);
    expect(chart.remove).toHaveBeenCalledTimes(1);
  });
});

describe("ChartCanvas: line mode", () => {
  it("adds one line series in the ink color, with whole-second times", () => {
    setup();
    expect(lib.state.series).toHaveLength(1);
    const [s] = lib.state.series;
    expect(s!.kind).toBe("Line");
    expect(s!.options).toMatchObject({
      color: "TEXT",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    expect(s!.api.setData).toHaveBeenCalledWith([
      { time: 100, value: 10 },
      { time: 200, value: 12 },
    ]);
    expect(lib.state.chart!.fitContent).toHaveBeenCalled();
  });

  it("formats the price axis as dollars, with a step that fits the price", () => {
    setup();
    const [s] = lib.state.series;
    const { priceFormat } = s!.api.applyOptions.mock.calls[0]![0] as {
      priceFormat: CapturedPriceFormat;
    };
    expect(priceFormat.type).toBe("custom");
    expect(priceFormat.formatter(83753.1)).toBe("$83,753.10");
    expect(priceFormat.minMove).toBe(0.01);
  });

  it("uses a finer step for sub-dollar prices", () => {
    setup({
      line: [
        { time: 1, value: 0.00001234 },
        { time: 2, value: 0.00001235 },
      ],
    });
    const { priceFormat } = lib.state.series[0]!.api.applyOptions.mock.calls[0]![0] as {
      priceFormat: CapturedPriceFormat;
    };
    expect(priceFormat.minMove).toBe(1e-8);
  });

  it("new data updates the existing series without rebuilding the chart", () => {
    const { rerender, onCrosshair } = setup();
    rerender(
      <ChartCanvas
        mode="line"
        line={[...line, { time: 300, value: 13 }]}
        candles={[]}
        range="7d"
        onCrosshair={onCrosshair}
      />,
    );
    expect(lib.state.createChart).toHaveBeenCalledTimes(1);
    expect(lib.state.series).toHaveLength(1);
    expect(lib.state.series[0]!.api.setData).toHaveBeenLastCalledWith([
      { time: 100, value: 10 },
      { time: 200, value: 12 },
      { time: 300, value: 13 },
    ]);
  });
});

describe("ChartCanvas: candle mode", () => {
  it("swaps the series: removes the line, adds candles colored by success/critical", () => {
    const { rerender, onCrosshair } = setup();
    const lineSeries = lib.state.series[0]!.api;
    rerender(
      <ChartCanvas
        mode="candle"
        line={line}
        candles={candles}
        range="7d"
        onCrosshair={onCrosshair}
      />,
    );
    expect(lib.state.chart!.removeSeries).toHaveBeenCalledWith(lineSeries);
    const candle = lib.state.series[1]!;
    expect(candle.kind).toBe("Candlestick");
    expect(candle.options).toMatchObject({
      upColor: "UP",
      downColor: "DOWN",
      wickUpColor: "UP",
      wickDownColor: "DOWN",
      borderVisible: false,
    });
    expect(candle.api.setData).toHaveBeenCalledWith([
      { time: 100, open: 10, high: 14, low: 9, close: 12 },
      { time: 200, open: 12, high: 15, low: 11, close: 11.5 },
    ]);
  });

  it("goes back to a line series just as cleanly", () => {
    const { rerender, onCrosshair } = setup({ mode: "candle", candles });
    expect(lib.state.series[0]!.kind).toBe("Candlestick");
    rerender(
      <ChartCanvas
        mode="line"
        line={line}
        candles={candles}
        range="7d"
        onCrosshair={onCrosshair}
      />,
    );
    expect(lib.state.series[1]!.kind).toBe("Line");
  });
});

describe("ChartCanvas: crosshair", () => {
  const move = (param: unknown) => act(() => lib.state.crosshairHandlers[0]!(param));

  it("reports the line value under the pointer", () => {
    const { onCrosshair } = setup();
    const series = lib.state.chart!.addSeries.mock.results[0]!.value;
    move({
      time: 200,
      point: { x: 1, y: 1 },
      seriesData: new Map([[series, { time: 200, value: 12 }]]),
    });
    expect(onCrosshair).toHaveBeenLastCalledWith({ time: 200, value: 12 });
  });

  it("reports full OHLC for candles", () => {
    const { onCrosshair } = setup({ mode: "candle", candles });
    const series = lib.state.chart!.addSeries.mock.results[0]!.value;
    move({
      time: 100,
      point: { x: 1, y: 1 },
      seriesData: new Map([
        [series, { time: 100, open: 10, high: 14, low: 9, close: 12 }],
      ]),
    });
    expect(onCrosshair).toHaveBeenLastCalledWith({
      time: 100,
      open: 10,
      high: 14,
      low: 9,
      close: 12,
    });
  });

  it("clears when the pointer leaves", () => {
    const { onCrosshair } = setup();
    move({ time: undefined, point: undefined, seriesData: new Map() });
    expect(onCrosshair).toHaveBeenLastCalledWith(null);
  });
});

describe("ChartCanvas: theme and range", () => {
  it("re-resolves colors when the theme class flips", async () => {
    setup();
    const chart = lib.state.chart!;
    chart.applyOptions.mockClear();
    theme.current = { ...theme.current, text: "NEWTEXT", background: "NEWBG" };

    await act(async () => {
      document.documentElement.classList.add("dark");
      await Promise.resolve();
    });

    const lastOptions = chart.applyOptions.mock.calls.at(-1)![0] as CapturedOptions;
    expect(lastOptions.layout.background.color).toBe("NEWBG");
    expect(lib.state.series[0]!.api.applyOptions).toHaveBeenCalledWith(
      expect.objectContaining({ color: "NEWTEXT" }),
    );
  });

  it("reapplies time formatting when the range changes, without rebuilding", () => {
    const { rerender, onCrosshair } = setup({ range: "7d" });
    const chart = lib.state.chart!;
    chart.applyOptions.mockClear();
    rerender(
      <ChartCanvas
        mode="line"
        line={line}
        candles={[]}
        range="1y"
        onCrosshair={onCrosshair}
      />,
    );
    expect(lib.state.createChart).toHaveBeenCalledTimes(1);
    const options = chart.applyOptions.mock.calls.at(-1)![0] as CapturedOptions;
    expect(options.timeScale.timeVisible).toBe(false); // daily data: no time of day
    // The crosshair label for a year of data is a date, not a time.
    expect(options.localization.timeFormatter(1_790_000_000)).toMatch(/\d{4}/);
  });

  it("shows time of day for short ranges", () => {
    setup({ range: "24h" });
    const options = lib.state.createChart.mock.calls[0]![1] as CapturedOptions;
    expect(options.timeScale.timeVisible).toBe(true);
    expect(options.localization.timeFormatter(1_790_000_000)).toMatch(/\d{2}:\d{2}/);
  });

  it("maps tick types to sensible labels", () => {
    setup({ range: "30d" });
    const { tickMarkFormatter } = (
      lib.state.createChart.mock.calls[0]![1] as CapturedOptions
    ).timeScale;
    const t = 1_790_000_000;
    expect(tickMarkFormatter(t, 0)).toMatch(/^\d{4}$/); // year
    expect(tickMarkFormatter(t, 1)).toMatch(/^[A-Za-z]+/); // month
    expect(tickMarkFormatter(t, 3)).toMatch(/\d{2}:\d{2}/); // time
  });
});
