import type { QueryClient } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatcher } from "@/hooks/use-hotkey";
import { queryKeys } from "@/lib/api/query-keys";
import { liveConnection, liveStore } from "@/lib/live/client";
import { installHistoryMock, uninstallHistoryMock } from "@/test/navigation";
import { renderWithClient } from "@/test/render";
import { PriceChart } from "./price-chart";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);

// What the stand-in canvas reports back to the tests (hoisted: vi.mock runs first).
const canvas = vi.hoisted(() => ({ zoomIn: vi.fn(), zoomOut: vi.fn() }));

// Stand-in for the dynamically imported canvas: expose what it was handed, and a way to
// act as the real one does when the user scrolls to the start of the data.
vi.mock("next/dynamic", () => ({
  default: () =>
    function MockChart(props: {
      mode: string;
      range: string;
      line: unknown[];
      candles: unknown[];
      scale: string;
      hasMore: boolean;
      resetKey: number;
      live?: unknown;
      onNearStart?: () => void;
      controlsRef?: { current: unknown };
    }) {
      if (props.controlsRef) {
        props.controlsRef.current = { zoomIn: canvas.zoomIn, zoomOut: canvas.zoomOut };
      }
      return (
        <div
          data-testid="chart"
          data-mode={props.mode}
          data-range={props.range}
          data-line={props.line.length}
          data-candles={props.candles.length}
          data-scale={props.scale}
          data-has-more={String(props.hasMore)}
          data-reset={props.resetKey}
          data-live={JSON.stringify(props.live ?? null)}
        >
          <button type="button" onClick={props.onNearStart}>
            simulate scrolling to the start
          </button>
        </div>
      );
    },
}));

const line = [
  { time: 1, value: 100 },
  { time: 2, value: 150 },
  { time: 3, value: 90 },
  { time: 4, value: 110 },
];
const candles = [
  { time: 1, open: 100, high: 130, low: 95, close: 120 },
  { time: 2, open: 120, high: 125, low: 80, close: 90 },
];

const setup = (url = "/coin/bitcoin", seed?: (c: QueryClient) => void) => {
  window.history.replaceState(null, "", url);
  return renderWithClient(<PriceChart id="bitcoin" name="Bitcoin" />, (client) => {
    client.setQueryData(queryKeys.coinChart("bitcoin", "7d"), line);
    seed?.(client);
  });
};

const search = () => window.location.search;
const chart = () => screen.getByTestId("chart");

beforeEach(() => {
  installHistoryMock();
  canvas.zoomIn.mockReset();
  canvas.zoomOut.mockReset();
});
afterEach(() => {
  uninstallHistoryMock();
  vi.unstubAllGlobals();
});

describe("PriceChart: controls", () => {
  it("shows the four ranges as tabs with 7D selected by default", () => {
    setup();
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["24H", "7D", "30D", "1Y"]);
    expect(screen.getByRole("tab", { name: "7D" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tablist", { name: "Time range" })).toBeInTheDocument();
  });

  it("offers line and candle modes, with line selected", () => {
    setup();
    expect(screen.getByRole("group", { name: "Chart type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Line" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Candles" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("restores range and mode from the URL", () => {
    setup("/coin/bitcoin?range=7d&mode=candle", (c) =>
      c.setQueryData(queryKeys.coinOhlc("bitcoin", "7d"), candles),
    );
    expect(chart()).toHaveAttribute("data-mode", "candle");
    expect(screen.getByRole("button", { name: "Candles" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("ignores junk in the URL and falls back to defaults", () => {
    setup("/coin/bitcoin?range=99y&mode=pie");
    expect(screen.getByRole("tab", { name: "7D" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(chart()).toHaveAttribute("data-mode", "line");
  });

  it("arrow keys move between ranges", async () => {
    setup();
    await userEvent.tab();
    expect(screen.getByRole("tab", { name: "7D" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "30D" })).toHaveFocus();
  });
});

describe("PriceChart: switching range", () => {
  it("requests that range and records it in the URL", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(line)));
    vi.stubGlobal("fetch", fetchMock);
    setup();

    await userEvent.click(screen.getByRole("tab", { name: "30D" }));
    expect(search()).toBe("?range=30d");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "/api/coins/bitcoin/chart?range=30d",
    );
    expect(chart()).toHaveAttribute("data-range", "30d");
  });

  it("returning to the default range leaves the URL clean", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => new Response(JSON.stringify(line))),
    );
    setup();
    await userEvent.click(screen.getByRole("tab", { name: "1Y" }));
    expect(search()).toBe("?range=1y");
    await userEvent.click(screen.getByRole("tab", { name: "7D" }));
    expect(search()).toBe("");
  });

  it("keeps the old chart on screen, dimmed, while the new range loads (no skeleton flash)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() => new Promise<Response>(() => {})),
    );
    setup();
    await userEvent.click(screen.getByRole("tab", { name: "24H" }));
    expect(screen.queryByRole("status", { name: "Loading chart" })).toBeNull();
    expect(chart()).toBeInTheDocument();
    expect(chart().parentElement).toHaveClass("opacity-60");
  });
});

describe("PriceChart: candles", () => {
  it("never requests OHLC data for a line-chart viewer", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(line)));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    await userEvent.click(screen.getByRole("tab", { name: "30D" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/ohlc"))).toBe(
      true,
    );
  });

  it("switching to candles fetches OHLC for the current range and records it in the URL", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(candles)),
    );
    vi.stubGlobal("fetch", fetchMock);
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Candles" }));
    expect(search()).toBe("?mode=candle");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]![0])).toBe("/api/coins/bitcoin/ohlc?range=7d");
    await waitFor(() => expect(chart()).toHaveAttribute("data-candles", "2"));
  });

  it("range and mode compose in the URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => new Response(JSON.stringify(candles))),
    );
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Candles" }));
    await userEvent.click(screen.getByRole("tab", { name: "30D" }));
    expect(search()).toBe("?range=30d&mode=candle");
  });

  it("when candles fail, says so and offers the line chart instead", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        async () =>
          new Response(
            JSON.stringify({ error: { code: "rate_limited", message: "Slow down" } }),
            { status: 429 },
          ),
      ),
    );
    setup("/coin/bitcoin?mode=candle");
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the chart");
    await userEvent.click(
      screen.getByRole("button", { name: /show the line chart instead/i }),
    );
    expect(search()).toBe("");
    expect(chart()).toHaveAttribute("data-mode", "line");
  });
});

describe("PriceChart: states", () => {
  it("shows a loading state while the first request is in flight", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() => new Promise<Response>(() => {})),
    );
    setup("/coin/bitcoin?range=1y");
    expect(screen.getByRole("status", { name: "Loading chart" })).toBeInTheDocument();
    expect(screen.queryByTestId("chart")).toBeNull();
  });

  it("shows a retryable error when the data can't be loaded", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "upstream_error", message: "x" } }),
          { status: 502 },
        ),
      )
      .mockResolvedValue(new Response(JSON.stringify(line)));
    vi.stubGlobal("fetch", fetchMock);
    setup("/coin/bitcoin?range=1y");

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the chart");
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(chart()).toBeInTheDocument());
  });

  it("explains an empty chart instead of drawing nothing", () => {
    setup("/coin/bitcoin", (c) =>
      c.setQueryData(queryKeys.coinChart("bitcoin", "7d"), [{ time: 1, value: 5 }]),
    );
    expect(screen.getByText("No chart data for this range")).toBeInTheDocument();
    expect(screen.queryByTestId("chart")).toBeNull();
  });
});

describe("PriceChart: summary and accessibility", () => {
  it("summarizes the range under the chart", () => {
    setup();
    const summary =
      screen.getByRole("group", { name: "7 days summary" }) ??
      screen.getByLabelText("7 days summary");
    const text = summary.textContent!;
    expect(text).toContain("$100.00"); // start
    expect(text).toContain("$110.00"); // latest
    expect(text).toContain("$150.00"); // high
    expect(text).toContain("$90.00"); // low
    expect(text).toContain("+10.00%"); // change
  });

  it("gives the canvas a text alternative with the real numbers", () => {
    setup();
    const img = screen.getByRole("img");
    expect(img).toHaveAccessibleName(
      "Bitcoin price over 7 days: from $100.00 to $110.00, high $150.00, low $90.00.",
    );
  });

  it("the label follows the range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => new Response(JSON.stringify(line))),
    );
    setup();
    await userEvent.click(screen.getByRole("tab", { name: "1Y" }));
    await waitFor(() =>
      expect(screen.getByRole("img").getAttribute("aria-label")).toContain("1 year"),
    );
  });

  it("has a heading for the section, hidden visually", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Price chart", level: 2 })).toHaveClass(
      "sr-only",
    );
    expect(
      within(screen.getByRole("region", { name: "Price chart" })).getByTestId("chart"),
    ).toBeInTheDocument();
  });

  it("is quiet while idle: nothing animates or announces on its own", () => {
    setup();
    expect(screen.queryByRole("alert")).toBeNull();
    act(() => {});
  });
});

/* ---- the axis scale, zoom, and scrolling back in time ----------------------- */

const older = [
  { time: -3, value: 80 },
  { time: -2, value: 85 },
  { time: -1, value: 70 },
];
/** A fetch that answers the older stretch (back=1) with `older`, or as told. */
function olderApi(reply: "ok" | "fail" | "pending" = "ok") {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    if (!String(input).includes("back=")) return new Response(JSON.stringify(line));
    if (reply === "pending") return new Promise<Response>(() => {});
    if (reply === "fail") {
      return new Response(
        JSON.stringify({ error: { code: "upstream_error", message: "x" } }),
        {
          status: 502,
        },
      );
    }
    return new Response(JSON.stringify(older));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const nearStart = () =>
  screen.getByRole("button", { name: "simulate scrolling to the start" });

describe("PriceChart: price axis", () => {
  it("offers Price and % for the line chart, defaulting to price", () => {
    setup();
    const group = screen.getByRole("group", { name: "Price axis" });
    expect(within(group).getByRole("button", { name: "Price" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(chart()).toHaveAttribute("data-scale", "price");
  });

  it("switches the chart to percent change and records it in the URL", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "%" }));
    expect(chart()).toHaveAttribute("data-scale", "percent");
    expect(search()).toBe("?scale=percent");
  });

  it("writes range, chart type and axis in one fixed order", async () => {
    setup("/coin/bitcoin?scale=percent");
    await userEvent.click(screen.getByRole("tab", { name: "30D" }));
    expect(search()).toBe("?range=30d&scale=percent");
  });

  it("restores the percent axis from the link", () => {
    setup("/coin/bitcoin?scale=percent");
    expect(chart()).toHaveAttribute("data-scale", "percent");
    expect(screen.getByRole("button", { name: "%" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("has no axis choice for candles: they are always priced in dollars", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(candles)));
    vi.stubGlobal("fetch", fetchMock);
    setup("/coin/bitcoin?mode=candle");
    expect(screen.queryByRole("group", { name: "Price axis" })).toBeNull();
  });
});

describe("PriceChart: zoom", () => {
  it("has buttons that zoom the chart", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(canvas.zoomIn).toHaveBeenCalledTimes(1);
    expect(canvas.zoomOut).toHaveBeenCalledTimes(1);
  });
});

describe("PriceChart: scrolling back in time", () => {
  it("starts with the timeframe's own window and says how to go further back", () => {
    olderApi();
    setup();
    expect(chart()).toHaveAttribute("data-line", String(line.length));
    expect(chart()).toHaveAttribute("data-has-more", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      /Drag the chart to go back in time/,
    );
  });

  it("loads older data when the chart reaches the start of what it has, and adds it to the chart", async () => {
    const fetchMock = olderApi();
    setup();
    await userEvent.click(nearStart());

    await waitFor(() =>
      expect(chart()).toHaveAttribute("data-line", String(line.length + older.length)),
    );
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls).toContain("/api/coins/bitcoin/chart?range=7d&back=1");
  });

  it("does not change the timeframe's own numbers as older data comes in", async () => {
    olderApi();
    setup();
    const summary = () =>
      screen.getByRole("group", { name: "7 days summary" }).textContent;
    const before = summary();
    await userEvent.click(nearStart());
    await waitFor(() =>
      expect(chart()).toHaveAttribute("data-line", String(line.length + older.length)),
    );
    expect(summary()).toBe(before);
  });

  it("says while it is loading, and offers a retry when it fails", async () => {
    olderApi("pending");
    setup();
    await userEvent.click(nearStart());
    expect(await screen.findByText("Loading earlier data…")).toBeVisible();
  });

  it("keeps what is on screen and offers a retry when older data fails", async () => {
    olderApi("fail");
    setup();
    await userEvent.click(nearStart());
    expect(await screen.findByText("Couldn't load earlier data.")).toBeVisible();
    expect(chart()).toHaveAttribute("data-line", String(line.length));
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("goes back to the latest window when the selected timeframe is pressed again", async () => {
    olderApi();
    setup();
    await userEvent.click(nearStart());
    await waitFor(() =>
      expect(chart()).toHaveAttribute("data-line", String(line.length + older.length)),
    );
    const resets = Number(chart().getAttribute("data-reset"));

    await userEvent.click(screen.getByRole("tab", { name: "7D" }));
    await waitFor(() =>
      expect(chart()).toHaveAttribute("data-line", String(line.length)),
    );
    expect(Number(chart().getAttribute("data-reset"))).toBe(resets + 1);
    expect(search()).toBe(""); // still the default timeframe: nothing to record
  });

  it("goes back to the latest window with the Latest button too", async () => {
    olderApi();
    setup();
    await userEvent.click(nearStart());
    await waitFor(() =>
      expect(chart()).toHaveAttribute("data-line", String(line.length + older.length)),
    );
    await userEvent.click(screen.getByRole("button", { name: "Latest" }));
    await waitFor(() =>
      expect(chart()).toHaveAttribute("data-line", String(line.length)),
    );
  });

  it("starts from the latest window again when another timeframe is picked", async () => {
    olderApi();
    setup();
    await userEvent.click(nearStart());
    await waitFor(() =>
      expect(chart()).toHaveAttribute("data-line", String(line.length + older.length)),
    );
    await userEvent.click(screen.getByRole("tab", { name: "30D" }));
    // The 30D chart is a different dataset: none of the 7D history is mixed into it.
    await waitFor(() => expect(chart()).toHaveAttribute("data-range", "30d"));
    expect(chart()).not.toHaveAttribute("data-line", String(line.length + older.length));
  });

  it("does not offer older history for the 1Y chart: it already holds the year", () => {
    olderApi();
    setup("/coin/bitcoin?range=1y", (c) =>
      c.setQueryData(queryKeys.coinChart("bitcoin", "1y"), line),
    );
    expect(chart()).toHaveAttribute("data-has-more", "false");
    expect(screen.getByRole("status")).toHaveTextContent(
      /1Y chart already holds the full year/,
    );
  });

  it("explains that candles only cover the selected range", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(candles))),
    );
    setup("/coin/bitcoin?mode=candle");
    expect(screen.getByText(/Candles cover the selected range only/)).toBeVisible();
  });
});

describe("PriceChart: keyboard", () => {
  const key = (k: string) =>
    act(() => {
      dispatcher.handleKeyDown(
        new KeyboardEvent("keydown", {
          key: k,
          code: /^\d$/.test(k) ? `Digit${k}` : `Key${k.toUpperCase()}`,
        }),
      );
    });
  const quietApi = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => new Response(JSON.stringify(line))),
    );

  it("1 to 4 pick the range, as clicking its tab does", async () => {
    quietApi();
    setup();
    key("3");
    expect(search()).toBe("?range=30d");
    key("1");
    expect(search()).toBe("?range=24h");
    key("4");
    expect(search()).toBe("?range=1y");
    key("2"); // back to the default: nothing to record
    expect(search()).toBe("");
    await waitFor(() => expect(chart()).toHaveAttribute("data-range", "7d"));
  });

  it("the key of the range already showing goes back to its latest window", () => {
    quietApi();
    setup();
    const resets = Number(chart().getAttribute("data-reset"));
    key("2"); // 7D is the range showing
    expect(Number(chart().getAttribute("data-reset"))).toBe(resets + 1);
    expect(search()).toBe("");
  });

  it("c switches between the line and candles", () => {
    quietApi();
    setup();
    key("c");
    expect(search()).toBe("?mode=candle");
    key("c");
    expect(search()).toBe("");
  });

  it("names its keys on the tabs for assistive technology", () => {
    setup();
    const keys = ["24H", "7D", "30D", "1Y"].map((name) =>
      screen.getByRole("tab", { name }).getAttribute("aria-keyshortcuts"),
    );
    expect(keys).toEqual(["1", "2", "3", "4"]);
  });

  it("stops answering once the chart is gone (1-4 are plain keys on other pages)", () => {
    quietApi();
    const { unmount } = setup();
    unmount();
    key("3");
    key("c");
    expect(search()).toBe("");
  });
});

describe("PriceChart: live prices", () => {
  const live = () => JSON.parse(chart().getAttribute("data-live")!);
  const renderLive = (props: {
    symbol?: string;
    rank?: number | null;
    price?: number | null;
  }) => {
    window.history.replaceState(null, "", "/coin/bitcoin");
    return renderWithClient(
      <PriceChart id="bitcoin" name="Bitcoin" {...props} />,
      (client) => {
        client.setQueryData(queryKeys.coinChart("bitcoin", "7d"), line);
      },
    );
  };
  const tick = (symbol: string, price: number) =>
    act(() => liveStore.applyTicks(new Map([[symbol, { price, time: 1 }]])));

  beforeEach(() => liveStore.clearData());
  afterEach(() => vi.restoreAllMocks());

  it("hands the canvas no live price until the feed has one", () => {
    renderLive({ symbol: "BTC", rank: 1, price: 100 });
    expect(live()).toBeNull();
  });

  it("hands it the live price once one arrives", () => {
    renderLive({ symbol: "BTC", rank: 1, price: 100 });
    tick("BTCUSDT", 104);
    expect(live()).toMatchObject({ price: 104 });
  });

  it("ignores a price far from the polled one (another coin with the same ticker)", () => {
    renderLive({ symbol: "BTC", rank: 1, price: 100 });
    tick("BTCUSDT", 5);
    expect(live()).toBeNull();
  });

  it("is not live at all without the coin's ticker", () => {
    renderLive({});
    tick("BTCUSDT", 104);
    expect(live()).toBeNull();
  });

  it("asks for the one-minute candle only after a live price has come, and carries its high and low", () => {
    const watch = vi.spyOn(liveConnection, "watchKline").mockReturnValue(() => {});
    renderLive({ symbol: "BTC", rank: 1, price: 100 });
    expect(watch).not.toHaveBeenCalled();
    tick("BTCUSDT", 104);
    expect(watch).toHaveBeenCalledWith("BTCUSDT");
    act(() =>
      liveStore.applyKlines(
        new Map([
          ["BTCUSDT", { openTime: 1, open: 100, high: 108, low: 99, close: 104 }],
        ]),
      ),
    );
    expect(live()).toEqual({ price: 104, high: 108, low: 99 });
  });
});
