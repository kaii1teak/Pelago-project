import type { QueryClient } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import { installHistoryMock, uninstallHistoryMock } from "@/test/navigation";
import { renderWithClient } from "@/test/render";
import { PriceChart } from "./price-chart";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);

// Stand-in for the dynamically imported canvas: expose what it was handed.
vi.mock("next/dynamic", () => ({
  default: () =>
    function MockChart(props: {
      mode: string;
      range: string;
      line: unknown[];
      candles: unknown[];
    }) {
      return (
        <div
          data-testid="chart"
          data-mode={props.mode}
          data-range={props.range}
          data-line={props.line.length}
          data-candles={props.candles.length}
        />
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

beforeEach(() => installHistoryMock());
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
