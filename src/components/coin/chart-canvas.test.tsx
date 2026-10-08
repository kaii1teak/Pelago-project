import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChartCanvas, { type ChartControls, type CrosshairInfo } from "./chart-canvas";

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
    rangeHandlers: [] as ((range: { from: number; to: number } | null) => void)[],
    createChart: undefined as unknown as ReturnType<typeof vi.fn>,
  };
  function makeSeries() {
    return { setData: vi.fn(), applyOptions: vi.fn() };
  }
  function makeChart() {
    const fitContent = vi.fn();
    const timeScale = {
      fitContent,
      getVisibleRange: vi.fn((): { from: number; to: number } | null => null),
      setVisibleRange: vi.fn(),
      getVisibleLogicalRange: vi.fn(() => ({ from: 10, to: 110 })),
      setVisibleLogicalRange: vi.fn(),
      subscribeVisibleLogicalRangeChange: vi.fn(
        (h: (range: { from: number; to: number } | null) => void) =>
          state.rangeHandlers.push(h),
      ),
      unsubscribeVisibleLogicalRangeChange: vi.fn(),
      options: () => ({ barSpacing: 10 }),
      scrollPosition: vi.fn(() => 0),
      scrollToPosition: vi.fn(),
    };
    const priceScale = { applyOptions: vi.fn() };
    return {
      fitContent,
      timeScaleApi: timeScale,
      priceScaleApi: priceScale,
      addSeries: vi.fn((def: { kind: string }, options: Record<string, unknown>) => {
        const api = makeSeries();
        state.series.push({ kind: def.kind, options, api });
        return api;
      }),
      removeSeries: vi.fn(),
      timeScale: () => timeScale,
      priceScale: () => priceScale,
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
  PriceScaleMode: { Normal: 0, Logarithmic: 1, Percentage: 2 },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Dotted: 1, Dashed: 2 },
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
    candleUp: "CANDLE_UP",
    candleUpLine: "CANDLE_UP_LINE",
    candleDown: "CANDLE_DOWN",
    candleDownLine: "CANDLE_DOWN_LINE",
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
  lib.state.rangeHandlers.length = 0;
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
      // The percent axis' 0% line takes the grid token, not the library's own gray.
      baseLineColor: "GRIDSTRONG",
      baseLineStyle: 1,
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
      upColor: "CANDLE_UP",
      downColor: "CANDLE_DOWN",
      borderUpColor: "CANDLE_UP_LINE",
      borderDownColor: "CANDLE_DOWN_LINE",
      wickUpColor: "CANDLE_UP_LINE",
      wickDownColor: "CANDLE_DOWN_LINE",
      borderVisible: true,
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

/* ---- scrolling back in time, zoom, scale ---------------------------------- */

const DAY = 86_400;
/** Hourly points across `days`, ending at `end`. */
const hourly = (end: number, days: number) =>
  Array.from({ length: days * 24 + 1 }, (_, i) => ({
    time: end - days * DAY + i * 3600,
    value: 100 + i,
  }));
const scroll = (range: { from: number; to: number }) =>
  act(() => lib.state.rangeHandlers.forEach((h) => h(range)));
const host = (container: HTMLElement) => container.firstElementChild as HTMLElement;
const timeScale = () => lib.state.chart!.timeScaleApi;

describe("ChartCanvas: scrolling back in time", () => {
  it("does not ask for older data until the user has touched the chart", () => {
    const onNearStart = vi.fn();
    setup({ hasMore: true, onNearStart });
    scroll({ from: 0, to: 100 }); // the chart opens with its left edge at the first bar
    expect(onNearStart).not.toHaveBeenCalled();
  });

  it("asks for older data when a touched chart is scrolled to the start of what is loaded", () => {
    const onNearStart = vi.fn();
    const { container } = setup({ hasMore: true, onNearStart });
    act(() => void host(container).dispatchEvent(new Event("pointerdown")));
    scroll({ from: 2, to: 102 });
    expect(onNearStart).toHaveBeenCalledTimes(1);
  });

  it("asks a little before the edge, but not while there is plenty of chart to the left", () => {
    const onNearStart = vi.fn();
    const { container } = setup({ hasMore: true, onNearStart });
    act(() => void host(container).dispatchEvent(new Event("pointerdown")));
    scroll({ from: 400, to: 500 });
    expect(onNearStart).not.toHaveBeenCalled();
    scroll({ from: 30, to: 130 });
    expect(onNearStart).toHaveBeenCalledTimes(1);
  });

  it("never asks when there is no more history", () => {
    const onNearStart = vi.fn();
    const { container } = setup({ hasMore: false, onNearStart });
    act(() => void host(container).dispatchEvent(new Event("pointerdown")));
    scroll({ from: -20, to: 80 });
    expect(onNearStart).not.toHaveBeenCalled();
  });

  it("lets the user scroll past the first bar only while there is more history to load", () => {
    const { rerender, onCrosshair } = setup({ hasMore: true });
    const first = lib.state.createChart.mock.calls[0]![1] as CapturedOptions & {
      timeScale: { fixLeftEdge: boolean };
    };
    expect(first.timeScale.fixLeftEdge).toBe(false);

    lib.state.chart!.applyOptions.mockClear();
    rerender(
      <ChartCanvas
        mode="line"
        line={line}
        candles={[]}
        range="7d"
        onCrosshair={onCrosshair}
        hasMore={false}
      />,
    );
    const last = lib.state.chart!.applyOptions.mock.calls.at(-1)![0] as {
      timeScale: { fixLeftEdge: boolean };
    };
    expect(last.timeScale.fixLeftEdge).toBe(true);
  });

  it("keeps the view where it is when older data is added on the left", () => {
    const { rerender, onCrosshair } = setup({
      hasMore: true,
      line: hourly(1_000_000, 7),
    });
    timeScale().fitContent.mockClear();
    timeScale().getVisibleRange.mockReturnValue({ from: 500_000, to: 900_000 });

    rerender(
      <ChartCanvas
        mode="line"
        line={[...hourly(1_000_000 - 7 * DAY, 7), ...hourly(1_000_000, 7)]}
        candles={[]}
        range="7d"
        onCrosshair={onCrosshair}
        hasMore
      />,
    );
    expect(timeScale().setVisibleRange).toHaveBeenLastCalledWith({
      from: 500_000,
      to: 900_000,
    });
    expect(timeScale().fitContent).not.toHaveBeenCalled();
  });

  it("leaves a view the user moved alone when the same data refreshes", () => {
    const base = hourly(1_000_000, 7);
    const { rerender, onCrosshair } = setup({ line: base });
    timeScale().fitContent.mockClear();
    timeScale().setVisibleRange.mockClear();

    rerender(
      <ChartCanvas
        mode="line"
        line={[...base, { time: 1_000_000 + 3600, value: 999 }]}
        candles={[]}
        range="7d"
        onCrosshair={onCrosshair}
      />,
    );
    expect(timeScale().fitContent).not.toHaveBeenCalled();
    expect(timeScale().setVisibleRange).not.toHaveBeenCalled();
  });

  it("starts at the latest window when the timeframe changes", () => {
    const { rerender, onCrosshair } = setup({ line: hourly(1_000_000, 7), range: "7d" });
    timeScale().fitContent.mockClear();
    rerender(
      <ChartCanvas
        mode="line"
        line={hourly(1_000_000, 30)}
        candles={[]}
        range="30d"
        onCrosshair={onCrosshair}
      />,
    );
    expect(timeScale().fitContent).toHaveBeenCalled();
  });

  it("shows just the timeframe's latest window when older history is loaded too", () => {
    const end = 5_000_000;
    setup({ line: hourly(end, 21), range: "7d", hasMore: true });
    expect(timeScale().setVisibleRange).toHaveBeenLastCalledWith({
      from: end - 7 * DAY,
      to: end,
    });
  });

  it("goes back to the latest window when told to reset", () => {
    const end = 5_000_000;
    const data = hourly(end, 21);
    const { rerender, onCrosshair } = setup({ line: data, range: "7d", hasMore: true });
    timeScale().setVisibleRange.mockClear();
    rerender(
      <ChartCanvas
        mode="line"
        line={data}
        candles={[]}
        range="7d"
        onCrosshair={onCrosshair}
        hasMore
        resetKey={1}
      />,
    );
    expect(timeScale().setVisibleRange).toHaveBeenLastCalledWith({
      from: end - 7 * DAY,
      to: end,
    });
  });

  it("forgets the user's touch on a reset: reaching the start no longer loads until they scroll again", () => {
    const onNearStart = vi.fn();
    const data = hourly(5_000_000, 21);
    const { container, rerender, onCrosshair } = setup({
      line: data,
      range: "7d",
      hasMore: true,
      onNearStart,
    });
    act(() => void host(container).dispatchEvent(new Event("pointerdown")));
    rerender(
      <ChartCanvas
        mode="line"
        line={data}
        candles={[]}
        range="7d"
        onCrosshair={onCrosshair}
        hasMore
        onNearStart={onNearStart}
        resetKey={1}
      />,
    );
    scroll({ from: 0, to: 100 });
    expect(onNearStart).not.toHaveBeenCalled();
  });
});

describe("ChartCanvas: zoom and pan", () => {
  const withControls = (
    props: Partial<React.ComponentProps<typeof ChartCanvas>> = {},
  ) => {
    const controlsRef = {
      current: null as ChartControls | null,
    };
    const utils = setup({ controlsRef, ...props });
    return { controlsRef, ...utils };
  };

  it("zooms in and out around the middle of the view, on request", () => {
    const { controlsRef } = withControls();
    controlsRef.current!.zoomIn();
    const inRange = timeScale().setVisibleLogicalRange.mock.calls.at(-1)![0] as {
      from: number;
      to: number;
    };
    expect(inRange.to - inRange.from).toBeLessThan(100);
    expect((inRange.from + inRange.to) / 2).toBeCloseTo(60); // the middle stayed put

    controlsRef.current!.zoomOut();
    const outRange = timeScale().setVisibleLogicalRange.mock.calls.at(-1)![0] as {
      from: number;
      to: number;
    };
    expect(outRange.to - outRange.from).toBeGreaterThan(100);
  });

  it("counts a zoom as touching the chart", () => {
    const onNearStart = vi.fn();
    const { controlsRef } = withControls({ hasMore: true, onNearStart });
    controlsRef.current!.zoomOut();
    scroll({ from: -30, to: 130 });
    expect(onNearStart).toHaveBeenCalled();
  });

  it("clears the controls when it goes away", () => {
    const { controlsRef, unmount } = withControls();
    expect(controlsRef.current).not.toBeNull();
    unmount();
    expect(controlsRef.current).toBeNull();
  });

  it("zooms with Ctrl or Cmd + wheel, and keeps that gesture from scrolling the page", () => {
    const { container } = setup();
    const ctrl = new WheelEvent("wheel", {
      ctrlKey: true,
      deltaY: -120,
      cancelable: true,
    });
    host(container).dispatchEvent(ctrl);
    expect(ctrl.defaultPrevented).toBe(true);
    expect(timeScale().setVisibleLogicalRange).toHaveBeenCalledTimes(1);

    const meta = new WheelEvent("wheel", {
      metaKey: true,
      deltaY: 120,
      cancelable: true,
    });
    host(container).dispatchEvent(meta);
    expect(meta.defaultPrevented).toBe(true);
    expect(timeScale().setVisibleLogicalRange).toHaveBeenCalledTimes(2);
  });

  it("limits how far one wheel event can zoom", () => {
    const { container } = setup();
    host(container).dispatchEvent(
      new WheelEvent("wheel", { ctrlKey: true, deltaY: -100_000, cancelable: true }),
    );
    const range = timeScale().setVisibleLogicalRange.mock.calls.at(-1)![0] as {
      from: number;
      to: number;
    };
    expect(range.to - range.from).toBeGreaterThanOrEqual(100 * 0.8 - 1e-9);
  });

  it("leaves vertical scrolling to the page", () => {
    const { container } = setup();
    const vertical = new WheelEvent("wheel", {
      deltaY: 200,
      deltaX: 3,
      cancelable: true,
    });
    host(container).dispatchEvent(vertical);
    expect(vertical.defaultPrevented).toBe(false);
    expect(timeScale().setVisibleLogicalRange).not.toHaveBeenCalled();
    expect(timeScale().scrollToPosition).not.toHaveBeenCalled();
  });

  it("pans on a sideways swipe, and that swipe is the chart's, not the page's", () => {
    const { container } = setup();
    timeScale().scrollPosition.mockReturnValue(5);
    const sideways = new WheelEvent("wheel", {
      deltaX: -50,
      deltaY: 4,
      cancelable: true,
    });
    host(container).dispatchEvent(sideways);
    expect(sideways.defaultPrevented).toBe(true);
    // 50px left at 10px per bar: five bars further back in time.
    expect(timeScale().scrollToPosition).toHaveBeenCalledWith(10, false);
  });

  it("stops listening when it goes away", () => {
    const { container, unmount } = setup();
    const el = host(container);
    unmount();
    const late = new WheelEvent("wheel", {
      ctrlKey: true,
      deltaY: -120,
      cancelable: true,
    });
    el.dispatchEvent(late);
    expect(late.defaultPrevented).toBe(false);
    expect(
      lib.state.chart!.timeScaleApi.unsubscribeVisibleLogicalRangeChange,
    ).toHaveBeenCalled();
  });
});

describe("ChartCanvas: price axis", () => {
  const modeOf = () =>
    lib.state.chart!.priceScaleApi.applyOptions.mock.calls.at(-1)![0] as { mode: number };

  it("shows dollars by default", () => {
    setup();
    expect(modeOf().mode).toBe(0);
  });

  it("switches to percent change when asked", () => {
    const { rerender, onCrosshair } = setup();
    rerender(
      <ChartCanvas
        mode="line"
        line={line}
        candles={[]}
        range="7d"
        onCrosshair={onCrosshair}
        scale="percent"
      />,
    );
    expect(modeOf().mode).toBe(2);
  });

  it("keeps candles in dollars: a percent axis makes no sense for them", () => {
    setup({ mode: "candle", line: [], candles, scale: "percent" });
    expect(modeOf().mode).toBe(0);
  });
});

describe("ChartCanvas: fading a new picture in", () => {
  const animate = vi.fn();
  beforeEach(() => {
    animate.mockClear();
    Element.prototype.animate = animate;
  });
  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, "animate");
  });

  const rerenderWith = (
    rerender: (ui: React.ReactElement) => void,
    onCrosshair: (info: CrosshairInfo | null) => void,
    props: Partial<React.ComponentProps<typeof ChartCanvas>>,
  ) =>
    rerender(
      <ChartCanvas
        mode="line"
        line={line}
        candles={[]}
        range="7d"
        onCrosshair={onCrosshair}
        {...props}
      />,
    );

  it("fades when the timeframe changes", () => {
    const { rerender, onCrosshair } = setup({ range: "7d" });
    animate.mockClear();
    rerenderWith(rerender, onCrosshair, { range: "30d" });
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]![0]).toEqual([{ opacity: 0 }, { opacity: 1 }]);
  });

  it("fades when the chart switches between line and candles", () => {
    const { rerender, onCrosshair } = setup({ mode: "line" });
    animate.mockClear();
    rerenderWith(rerender, onCrosshair, { mode: "candle", candles });
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("does not fade when the same chart just refreshes its data", () => {
    const { rerender, onCrosshair } = setup();
    animate.mockClear();
    rerenderWith(rerender, onCrosshair, { line: [...line, { time: 300, value: 13 }] });
    expect(animate).not.toHaveBeenCalled();
  });
});
