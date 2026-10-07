import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import type { TrendingCoin } from "@/lib/api/schemas";
import { mockApi, renderWithClient } from "@/test/render";
import { TrendingSection } from "./trending-section";

afterEach(() => vi.unstubAllGlobals());

const coin = (over: Partial<TrendingCoin> & { id: string }): TrendingCoin => ({
  name: over.id,
  symbol: over.id.toUpperCase(),
  rank: 10,
  image: null,
  price: 1.5,
  change24h: 2,
  ...over,
});

describe("TrendingSection", () => {
  it("renders a card per coin with one link to its page and its rank", () => {
    renderWithClient(<TrendingSection />, (c) =>
      c.setQueryData(queryKeys.trending, [coin({ id: "orca", name: "Orca", rank: 194 })]),
    );
    const link = screen.getByRole("link", { name: /Orca/ });
    expect(link).toHaveAttribute("href", "/coin/orca");
    expect(screen.getByText("#194")).toBeInTheDocument();
    expect(screen.getByText("$1.50")).toBeInTheDocument();
  });

  it("shows only the first six", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      coin({ id: `coin${i}`, name: `Coin ${i}` }),
    );
    renderWithClient(<TrendingSection />, (c) =>
      c.setQueryData(queryKeys.trending, many),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });

  it("copes with missing price, change and rank", () => {
    renderWithClient(<TrendingSection />, (c) =>
      c.setQueryData(queryKeys.trending, [
        coin({ id: "ghost", name: "Ghost", price: null, change24h: null, rank: null }),
      ]),
    );
    expect(screen.getByText("Ghost")).toBeInTheDocument();
    expect(screen.queryByText(/#/)).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a loading state, then an error with retry", async () => {
    mockApi({ "/api/trending": "fail" });
    renderWithClient(<TrendingSection />);
    expect(
      screen.getByRole("status", { name: "Loading trending assets" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load trending assets",
    );
  });

  it("shows an empty state when nothing is trending", () => {
    renderWithClient(<TrendingSection />, (c) => c.setQueryData(queryKeys.trending, []));
    expect(screen.getByText("Nothing is trending yet")).toBeInTheDocument();
  });
});
