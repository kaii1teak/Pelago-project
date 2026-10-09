import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import { makeCoin } from "@/test/fixtures";
import { mockApi, renderWithClient } from "@/test/render";
import { HeatmapPreview } from "./heatmap-preview";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 900, height: 270 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const market = Array.from({ length: 50 }, (_, i) =>
  makeCoin({ id: `coin-${i + 1}`, rank: i + 1, marketCap: 1e9 / (i + 1) }),
);

describe("HeatmapPreview", () => {
  it("draws the biggest thirty assets from the markets list the page already has", () => {
    const fetchMock = mockApi({});
    renderWithClient(<HeatmapPreview />, (client) =>
      client.setQueryData(queryKeys.markets(), market),
    );
    expect(screen.getAllByRole("link", { name: /^Coin-\d+ \(/ })).toHaveLength(30);
    // It asked for nothing of its own.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is colored by the day's change, and says so", () => {
    renderWithClient(<HeatmapPreview />, (client) =>
      client.setQueryData(queryKeys.markets(), market),
    );
    expect(screen.getByText(/price change over 24 hours/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /over 24 hours/ }).length).toBeGreaterThan(
      0,
    );
  });

  it("leads to the full heatmap", () => {
    renderWithClient(<HeatmapPreview />, (client) =>
      client.setQueryData(queryKeys.markets(), market),
    );
    expect(screen.getByRole("link", { name: /Open the heatmap/ })).toHaveAttribute(
      "href",
      "/heatmap",
    );
    expect(
      screen.getByRole("heading", { name: "The whole market in one picture" }),
    ).toBeInTheDocument();
  });

  it("holds its place while loading, and offers a retry when it can't load", async () => {
    mockApi({ "/api/markets": "pending" });
    const { unmount } = renderWithClient(<HeatmapPreview />);
    expect(
      screen.getByRole("status", { name: "Loading the heatmap" }),
    ).toBeInTheDocument();
    unmount();

    mockApi({ "/api/markets": "fail" });
    renderWithClient(<HeatmapPreview />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't load/);
  });
});
