import type { QueryClient } from "@tanstack/react-query";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import type { HeatCoin } from "@/lib/api/schemas";
import { liveStore } from "@/lib/live/client";
import { installHistoryMock, uninstallHistoryMock } from "@/test/navigation";
import { mockApi, renderWithClient } from "@/test/render";
import { HeatmapView } from "./heatmap-view";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);

function stubFrame(width = 800, height = 480) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width, height } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

/** A phone: the viewport media query matches. */
function phone(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on && query.includes("max-width"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

const coin = (i: number, over: Partial<HeatCoin> = {}): HeatCoin => ({
  id: `coin-${i}`,
  symbol: `C${i}`,
  name: `Coin ${i}`,
  image: null,
  rank: i,
  price: 100 + i,
  marketCap: 1_000_000 / i,
  volume24h: 5000 * i,
  change1h: 0.1,
  change24h: 2,
  change7d: -4,
  ...over,
});
const COINS = Array.from({ length: 120 }, (_, i) => coin(i + 1));

const pressed = (name: string, group: string) =>
  within(screen.getByRole("group", { name: group })).getByRole("button", { name });
const links = () => screen.queryAllByRole("link");

beforeEach(() => {
  installHistoryMock();
  window.history.replaceState(null, "", "/heatmap");
  stubFrame();
  phone(false);
  liveStore.clearData();
});
afterEach(() => {
  uninstallHistoryMock();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const seeded =
  (category: string | null = null, data: HeatCoin[] = COINS) =>
  (client: QueryClient) =>
    client.setQueryData(queryKeys.heatmap(category), data);

describe("HeatmapView: the defaults", () => {
  it("shows the day's change, the top hundred, sized by market cap, over every asset", () => {
    renderWithClient(<HeatmapView />, seeded());
    expect(pressed("24H", "Color by change")).toHaveAttribute("aria-pressed", "true");
    expect(pressed("Top 100", "Assets")).toHaveAttribute("aria-pressed", "true");
    expect(pressed("Market cap", "Size by")).toHaveAttribute("aria-pressed", "true");
    expect(pressed("All assets", "Category")).toHaveAttribute("aria-pressed", "true");
    expect(links()).toHaveLength(100);
  });

  it("starts with fewer assets on a phone, where there is less room", () => {
    phone(true);
    renderWithClient(<HeatmapView />, seeded());
    expect(pressed("Top 50", "Assets")).toHaveAttribute("aria-pressed", "true");
    expect(links()).toHaveLength(50);
  });

  it("tells keyboard users how to move around inside the picture", () => {
    renderWithClient(<HeatmapView />, seeded());
    expect(screen.getByText(/arrow keys move between assets/)).toBeInTheDocument();
  });

  it("explains the colors for the period it shows", () => {
    renderWithClient(<HeatmapView />, seeded());
    expect(screen.getByText(/price change over 24 hours/)).toBeInTheDocument();
  });
});

describe("HeatmapView: the URL is the state", () => {
  it("reads every choice from a shared link", () => {
    window.history.replaceState(
      null,
      "",
      "/heatmap?period=7d&top=50&size=volume&category=layer-1",
    );
    renderWithClient(<HeatmapView />, seeded("layer-1"));
    expect(pressed("7D", "Color by change")).toHaveAttribute("aria-pressed", "true");
    expect(pressed("Top 50", "Assets")).toHaveAttribute("aria-pressed", "true");
    expect(pressed("24h volume", "Size by")).toHaveAttribute("aria-pressed", "true");
    expect(pressed("Layer 1", "Category")).toHaveAttribute("aria-pressed", "true");
    expect(links()).toHaveLength(50);
    expect(screen.getByText(/price change over 7 days/)).toBeInTheDocument();
  });

  it("a bad link still loads the default view", () => {
    window.history.replaceState(null, "", "/heatmap?period=1y&top=75&category=nope");
    renderWithClient(<HeatmapView />, seeded());
    expect(pressed("24H", "Color by change")).toHaveAttribute("aria-pressed", "true");
    expect(links()).toHaveLength(100);
  });

  it("writes a choice to the URL, and leaves defaults out of it", async () => {
    const user = userEvent.setup();
    renderWithClient(<HeatmapView />, seeded());
    await user.click(pressed("7D", "Color by change"));
    expect(window.location.search).toBe("?period=7d");
    await user.click(pressed("Top 200", "Assets"));
    expect(window.location.search).toBe("?period=7d&top=200");
    await user.click(pressed("24H", "Color by change"));
    expect(window.location.search).toBe("?top=200");
  });

  it("changing period or size re-colors and re-sizes without asking the server again", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({});
    renderWithClient(<HeatmapView />, seeded());
    await user.click(pressed("7D", "Color by change"));
    await user.click(pressed("24h volume", "Size by"));
    await user.click(pressed("Top 50", "Assets"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(links()).toHaveLength(50);
  });

  it("a category is a step in history: Back returns to the one before", async () => {
    const user = userEvent.setup();
    renderWithClient(<HeatmapView />, (client) => {
      seeded()(client);
      seeded("gaming", COINS.slice(0, 30))(client);
    });
    const before = window.history.length;
    await user.click(pressed("Gaming", "Category"));
    expect(window.location.search).toBe("?category=gaming");
    expect(window.history.length).toBe(before + 1);
    expect(links()).toHaveLength(30);
  });
});

describe("HeatmapView: when the data isn't there", () => {
  it("holds the place of the picture while loading", () => {
    mockApi({ "/api/heatmap": "pending" });
    renderWithClient(<HeatmapView />);
    expect(
      screen.getByRole("status", { name: "Loading the heatmap" }),
    ).toBeInTheDocument();
    expect(links()).toHaveLength(0);
  });

  it("says so when it can't load, and offers to try again", async () => {
    mockApi({ "/api/heatmap": "fail" });
    renderWithClient(<HeatmapView />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Couldn't load the heatmap/,
    );
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
  });

  it("says when a category has nothing in it", () => {
    window.history.replaceState(null, "", "/heatmap?category=depin");
    renderWithClient(<HeatmapView />, seeded("depin", []));
    expect(screen.getByRole("heading", { name: "No assets here" })).toBeInTheDocument();
    expect(screen.getByText(/DePIN has nothing to show/)).toBeInTheDocument();
  });

  it("keeps the old picture, dimmed, while another category loads", async () => {
    const user = userEvent.setup();
    mockApi({ "/api/heatmap?category=gaming": "pending" });
    renderWithClient(<HeatmapView />, seeded());
    await user.click(pressed("Gaming", "Category"));
    expect(links().length).toBeGreaterThan(0);
    expect(document.querySelector(".heat-frame")).toHaveAttribute("aria-busy", "true");
    await act(async () => {});
  });

  it("keeps the last picture and says refreshing failed, when a refresh fails", async () => {
    mockApi({ "/api/heatmap": "fail" });
    const { client } = renderWithClient(<HeatmapView />, seeded());
    await act(() => client.refetchQueries({ queryKey: ["heatmap"] }));
    expect(
      await screen.findByText("Reconnecting, showing last data"),
    ).toBeInTheDocument();
    expect(links()).toHaveLength(100);
  });
});
