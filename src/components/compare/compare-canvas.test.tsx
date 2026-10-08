import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CompareCanvas, {
  type CompareCrosshair,
  type CompareSeries,
} from "./compare-canvas";

// A recording stand-in for the charting library: we assert how it's *driven*.
const lib = vi.hoisted(() => {
  type FakeSeries = {
    options: Record<string, unknown>;
    setData: ReturnType<typeof vi.fn>;
    applyOptions: ReturnType<typeof vi.fn>;
    createPriceLine: ReturnType<typeof vi.fn>;
    removePriceLine: ReturnType<typeof vi.fn>;
    line?: { applyOptions: ReturnType<typeof vi.fn> };
  };
  const state = {
    series: [] as FakeSeries[],
    chart: null as null | {
      addSeries: ReturnType<typeof vi.fn>;
      removeSeries: ReturnType<typeof vi.fn>;
      applyOptions: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
      fitContent: ReturnType<typeof vi.fn>;
    },
    handlers: [] as ((param: unknown) => void)[],
    createChart: undefined as unknown as ReturnType<typeof vi.fn>,
  };
  function makeSeries(options: Record<string, unknown>): FakeSeries {
    const s: FakeSeries = {
      options,
      setData: vi.fn(),
      applyOptions: vi.fn(),
      createPriceLine: vi.fn(() => (s.line = { applyOptions: vi.fn() })),
      removePriceLine: vi.fn(),
    };
    return s;
  }
  state.createChart = vi.fn(() => {
    const fitContent = vi.fn();
    const chart = {
      addSeries: vi.fn((_def: unknown, options: Record<string, unknown>) => {
        const s = makeSeries(options);
        state.series.push(s);
        return s;
      }),
      removeSeries: vi.fn(),
      applyOptions: vi.fn(),
      remove: vi.fn(),
      fitContent,
      timeScale: () => ({ fitContent }),
      subscribeCrosshairMove: vi.fn((h: (p: unknown) => void) => state.handlers.push(h)),
      unsubscribeCrosshairMove: vi.fn(),
    };
    state.chart = chart;
    return chart;
  });
  return { state };
});

vi.mock("lightweight-charts", () => ({
  createChart: lib.state.createChart,
  LineSeries: { kind: "Line" },
  ColorType: { Solid: "solid" },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Dashed: 2, Dotted: 1 },
  PriceScaleMode: { Normal: 0, Logarithmic: 1, Percentage: 2 },
  TickMarkType: { Year: 0, Month: 1, DayOfMonth: 2, Time: 3, TimeWithSeconds: 4 },
}));

// jsdom has no stylesheet, so resolve tokens from a controllable theme instead.
const theme = vi.hoisted(() => ({
  colors: Array.from({ length: 10 }, (_, i) => `C${i}`),
}));
vi.mock("@/components/coin/chart-theme", () => ({
  readChartTheme: () => ({
    background: "BG",
    text: "TEXT",
    muted: "MUTED",
    grid: "GRID",
    gridStrong: "GRIDSTRONG",
    inverse: "INVERSE",
    inverseText: "INVERSETEXT",
    fontFamily: "MONO",
  }),
  readSeriesColors: () => [...theme.colors],
}));

const points = [
  { time: 100, value: 0 },
  { time: 200, value: 5 },
];
const btc: CompareSeries = { id: "bitcoin", color: 0, points };
const eth: CompareSeries = { id: "ethereum", color: 7, points };
const sol: CompareSeries = { id: "solana", color: 3, points };

function setup(
  initial: CompareSeries[],
  range: "7d" | "1y" = "7d",
  chartView: "change" | "price" = "change",
) {
  const onCrosshair = vi.fn<(info: CompareCrosshair | null) => void>();
  const view = render(
    <CompareCanvas
      series={initial}
      range={range}
      view={chartView}
      onCrosshair={onCrosshair}
    />,
  );
  const rerender = (
    next: CompareSeries[],
    r: "7d" | "1y" = range,
    v: "change" | "price" = chartView,
  ) =>
    view.rerender(
      <CompareCanvas series={next} range={r} view={v} onCrosshair={onCrosshair} />,
    );
  return { ...view, rerender, onCrosshair };
}

beforeEach(() => {
  lib.state.series = [];
  lib.state.handlers = [];
  lib.state.createChart.mockClear();
  theme.colors = Array.from({ length: 10 }, (_, i) => `C${i}`);
  document.documentElement.classList.remove("dark");
});

type Options = {
  localization: {
    priceFormatter: (v: number) => string;
    timeFormatter: (t: number) => string;
  };
};

describe("CompareCanvas: setup", () => {
  it("creates the chart once and labels the price axis in percent, keeping the time label", () => {
    setup([btc, eth]);
    expect(lib.state.createChart).toHaveBeenCalledTimes(1);
    const options = lib.state.createChart.mock.calls[0]![1] as Options;
    expect(options.localization.priceFormatter(12.345)).toBe("+12.3%");
    expect(options.localization.priceFormatter(-3)).toBe("-3.0%");
    expect(options.localization.timeFormatter(1_790_000_000)).toMatch(/\d/);
  });

  it("never captures the page's scrolling", () => {
    setup([btc]);
    const options = lib.state.createChart.mock.calls[0]![1] as {
      handleScroll: { mouseWheel: boolean; vertTouchDrag: boolean };
      handleScale: { mouseWheel: boolean };
    };
    expect(options.handleScale.mouseWheel).toBe(false);
    expect(options.handleScroll.mouseWheel).toBe(false);
    expect(options.handleScroll.vertTouchDrag).toBe(false);
  });

  it("removes the chart on unmount", () => {
    const { unmount } = setup([btc]);
    const chart = lib.state.chart!;
    unmount();
    expect(chart.remove).toHaveBeenCalledTimes(1);
  });
});

describe("CompareCanvas: lines", () => {
  it("draws one line per asset, each in its own color, with its data", () => {
    setup([btc, eth, sol]);
    expect(lib.state.series.map((s) => s.options.color)).toEqual(["C0", "C7", "C3"]);
    expect(lib.state.series[0]!.setData).toHaveBeenCalledWith([
      { time: 100, value: 0 },
      { time: 200, value: 5 },
    ]);
  });

  it("formats every line's values in percent (the crosshair label)", () => {
    setup([btc]);
    const format = (
      lib.state.series[0]!.options.priceFormat as { formatter: (v: number) => string }
    ).formatter;
    expect(format(4.216)).toBe("+4.22%");
  });

  it("adds only the new line when an asset is added, without rebuilding the chart", () => {
    const { rerender } = setup([btc]);
    rerender([btc, eth]);
    expect(lib.state.createChart).toHaveBeenCalledTimes(1);
    expect(lib.state.series).toHaveLength(2);
    expect(lib.state.chart!.addSeries).toHaveBeenCalledTimes(2);
  });

  it("removes only that line when an asset is removed", () => {
    const { rerender } = setup([btc, eth, sol]);
    const removed = lib.state.series[1]!;
    rerender([btc, sol]);
    expect(lib.state.chart!.removeSeries).toHaveBeenCalledTimes(1);
    expect(lib.state.chart!.removeSeries).toHaveBeenCalledWith(removed);
    expect(lib.state.series).toHaveLength(3); // nothing re-added
  });

  it("recolors a line whose color changed instead of recreating it", () => {
    const { rerender } = setup([btc, eth]);
    const ethApi = lib.state.series[1]!;
    rerender([{ ...eth, color: 5 }]);
    expect(ethApi.applyOptions).toHaveBeenCalledWith(
      expect.objectContaining({ color: "C5" }),
    );
    expect(lib.state.series).toHaveLength(2);
  });

  it("draws nothing for no series", () => {
    setup([]);
    expect(lib.state.series).toHaveLength(0);
  });

  it("fits the content after the data changes", () => {
    const { rerender } = setup([btc]);
    lib.state.chart!.fitContent.mockClear();
    rerender([btc, eth]);
    expect(lib.state.chart!.fitContent).toHaveBeenCalled();
  });
});

describe("CompareCanvas: the 0% reference", () => {
  it("hangs one dotted line at 0 on the first series", () => {
    setup([btc, eth]);
    expect(lib.state.series[0]!.createPriceLine).toHaveBeenCalledTimes(1);
    expect(lib.state.series[0]!.createPriceLine).toHaveBeenCalledWith(
      expect.objectContaining({ price: 0, lineStyle: 1, axisLabelVisible: false }),
    );
    expect(lib.state.series[1]!.createPriceLine).not.toHaveBeenCalled();
  });

  it("moves to the new first series when the first one is removed", () => {
    const { rerender } = setup([btc, eth]);
    rerender([eth]);
    expect(lib.state.series[1]!.createPriceLine).toHaveBeenCalledTimes(1);
  });

  it("is not duplicated when other series come and go", () => {
    const { rerender } = setup([btc, eth]);
    rerender([btc, eth, sol]);
    rerender([btc, sol]);
    expect(lib.state.series[0]!.createPriceLine).toHaveBeenCalledTimes(1);
  });
});

describe("CompareCanvas: crosshair", () => {
  const move = (param: unknown) => act(() => lib.state.handlers[0]!(param));

  it("reports each asset's value under the pointer, by id", () => {
    const { onCrosshair } = setup([btc, eth]);
    const [a, b] = lib.state.series;
    move({
      point: { x: 1, y: 1 },
      time: 150,
      seriesData: new Map([
        [a, { value: 1.5 }],
        [b, { value: -2 }],
      ]),
    });
    expect(onCrosshair).toHaveBeenLastCalledWith({
      time: 150,
      values: { bitcoin: 1.5, ethereum: -2 },
    });
  });

  it("reports null once the pointer leaves the chart", () => {
    const { onCrosshair } = setup([btc]);
    move({ point: undefined, time: undefined, seriesData: new Map() });
    expect(onCrosshair).toHaveBeenLastCalledWith(null);
  });
});

describe("CompareCanvas: theme and range", () => {
  it("re-resolves the line colors when the theme flips, without rebuilding", async () => {
    setup([btc, eth]);
    theme.colors = Array.from({ length: 10 }, (_, i) => `N${i}`);
    await act(async () => {
      document.documentElement.classList.add("dark");
      await Promise.resolve();
    });
    expect(lib.state.series[0]!.applyOptions).toHaveBeenCalledWith(
      expect.objectContaining({ color: "N0" }),
    );
    expect(lib.state.series[1]!.applyOptions).toHaveBeenCalledWith(
      expect.objectContaining({ color: "N7" }),
    );
    expect(lib.state.series[0]!.line!.applyOptions).toHaveBeenCalled();
    expect(lib.state.createChart).toHaveBeenCalledTimes(1);
  });

  it("reapplies time formatting when the range changes, without rebuilding", () => {
    const { rerender } = setup([btc], "7d");
    lib.state.chart!.applyOptions.mockClear();
    rerender([btc], "1y");
    expect(lib.state.createChart).toHaveBeenCalledTimes(1);
    const options = lib.state.chart!.applyOptions.mock.calls.at(-1)![0] as {
      timeScale: { timeVisible: boolean };
    } & Options;
    expect(options.timeScale.timeVisible).toBe(false); // daily data: no time of day
    expect(options.localization.priceFormatter(1)).toBe("+1.0%");
  });
});

describe("CompareCanvas: price view", () => {
  type AxisOptions = {
    rightPriceScale: { mode: number };
    localization: { priceFormatter: (v: number) => string };
  };

  it("plots prices on a logarithmic axis in dollars", () => {
    setup([btc, eth], "7d", "price");
    const options = lib.state.createChart.mock.calls[0]![1] as AxisOptions;
    expect(options.rightPriceScale.mode).toBe(1);
    expect(options.localization.priceFormatter(83753.1)).toBe("$83,753.10");
  });

  it("shows each value as dollars in the crosshair label", () => {
    setup([btc], "7d", "price");
    const format = (
      lib.state.series[0]!.options.priceFormat as { formatter: (v: number) => string }
    ).formatter;
    expect(format(0.00001234)).toMatch(/^\$0\.0000123/);
  });

  it("has no 0% reference line: it means nothing for prices", () => {
    setup([btc, eth], "7d", "price");
    expect(lib.state.series[0]!.createPriceLine).not.toHaveBeenCalled();
  });

  it("keeps the percent view on a normal axis with the 0% line", () => {
    setup([btc, eth], "7d", "change");
    const options = lib.state.createChart.mock.calls[0]![1] as AxisOptions;
    expect(options.rightPriceScale.mode).toBe(0);
    expect(lib.state.series[0]!.createPriceLine).toHaveBeenCalledTimes(1);
  });

  it("switches between the views without rebuilding the chart", () => {
    const { rerender } = setup([btc, eth], "7d", "change");
    lib.state.chart!.applyOptions.mockClear();
    rerender([btc, eth], "7d", "price");
    expect(lib.state.createChart).toHaveBeenCalledTimes(1);
    const options = lib.state.chart!.applyOptions.mock.calls.at(-1)![0] as AxisOptions;
    expect(options.rightPriceScale.mode).toBe(1);
    // Each line's own label format follows too.
    const format = (
      lib.state.series[0]!.applyOptions.mock.calls.at(-1)![0] as {
        priceFormat: { formatter: (v: number) => string };
      }
    ).priceFormat.formatter;
    expect(format(1234.5)).toBe("$1,234.50");
  });

  it("drops the 0% line when switching to prices, and brings it back", () => {
    const { rerender } = setup([btc, eth], "7d", "change");
    const first = lib.state.series[0]!;
    rerender([btc, eth], "7d", "price");
    expect(first.removePriceLine).toHaveBeenCalledTimes(1);
    rerender([btc, eth], "7d", "change");
    expect(first.createPriceLine).toHaveBeenCalledTimes(2);
  });
});
