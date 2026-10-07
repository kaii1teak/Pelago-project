import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import type { GlobalStats } from "@/lib/api/schemas";
import { makeCoin } from "@/test/fixtures";
import { mockApi, renderWithClient } from "@/test/render";
import { StatsStrip } from "./stats-strip";

const globalStats: GlobalStats = {
  totalMarketCap: 2_410_000_000_000,
  btcDominance: 52.41,
  ethDominance: 17.08,
  marketCapChange24h: -1.23,
  activeCryptocurrencies: 17432,
  markets: 1245,
  updatedAt: 1_759_700_000,
};
const markets = [
  makeCoin({ id: "bitcoin", volume24h: 30_000_000_000 }),
  makeCoin({ id: "ethereum", volume24h: 12_000_000_000 }),
  makeCoin({ id: "nothing", volume24h: null }),
];

afterEach(() => vi.unstubAllGlobals());

describe("StatsStrip", () => {
  it("shows all four live stats, with volume summed from the markets data", () => {
    renderWithClient(<StatsStrip />, (client) => {
      client.setQueryData(queryKeys.global, globalStats);
      client.setQueryData(queryKeys.markets(), markets);
    });

    // CountUp renders the value twice: animated (aria-hidden) and for screen readers.
    expect(screen.getAllByText("$2.41T")).toHaveLength(2);
    expect(screen.getAllByText("$42B")).toHaveLength(2); // 30B + 12B + (null -> 0)
    expect(screen.getAllByText("52.4%")).toHaveLength(2);
    expect(screen.getAllByText("17,432")).toHaveLength(2);

    expect(screen.getByText("Ethereum 17.1%")).toBeInTheDocument();
    expect(screen.getByText("On 1,245 exchanges")).toBeInTheDocument();
    expect(screen.getByText("Top 100 assets")).toBeInTheDocument();
    expect(screen.getByText("-1.23%")).toBeInTheDocument();
  });

  it("is a labelled description list (term/definition pairs) for assistive tech", () => {
    const { container } = renderWithClient(<StatsStrip />, (client) => {
      client.setQueryData(queryKeys.global, globalStats);
      client.setQueryData(queryKeys.markets(), markets);
    });
    expect(screen.getByRole("region", { name: "Market overview" })).toBeInTheDocument();
    expect(container.querySelectorAll("dt")).toHaveLength(4);
    expect(container.querySelectorAll("dd")).toHaveLength(4);
  });

  it("shows skeletons, not numbers, while loading", () => {
    mockApi({ "/api/global": "pending", "/api/markets": "pending" });
    renderWithClient(<StatsStrip />);
    expect(screen.getByText("Total market cap")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows one retryable error when both sources fail with nothing cached", async () => {
    const fetchMock = mockApi({ "/api/global": "fail", "/api/markets": "fail" });
    renderWithClient(<StatsStrip />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load market stats",
    );
    const callsBefore = fetchMock.mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("degrades per stat: a failed markets request only blanks the volume", async () => {
    mockApi({ "/api/global": globalStats, "/api/markets": "fail" });
    renderWithClient(<StatsStrip />);

    expect((await screen.findAllByText("$2.41T")).length).toBeGreaterThan(0);
    expect(await screen.findByText("unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findByText(/reconnecting/i)).toBeInTheDocument();
  });

  it("says it's live when everything is healthy", () => {
    renderWithClient(<StatsStrip />, (client) => {
      client.setQueryData(queryKeys.global, globalStats);
      client.setQueryData(queryKeys.markets(), markets);
    });
    expect(screen.getByText(/live · refreshes every minute/i)).toBeInTheDocument();
  });
});
