import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import { makeCoin } from "@/test/fixtures";
import { mockApi, renderWithClient } from "@/test/render";
import { MoversSection } from "./movers-section";

afterEach(() => vi.unstubAllGlobals());

const mixed = [
  makeCoin({ id: "alpha", name: "Alpha", change24h: 4 }),
  makeCoin({ id: "bravo", name: "Bravo", change24h: 12 }),
  makeCoin({ id: "charlie", name: "Charlie", change24h: -6 }),
  makeCoin({ id: "delta", name: "Delta", change24h: -2 }),
];

describe("MoversSection", () => {
  it("lists gainers biggest-first and losers worst-first, each linking to the asset", () => {
    renderWithClient(<MoversSection />, (c) =>
      c.setQueryData(queryKeys.markets(), mixed),
    );

    const gainers = within(
      screen.getByRole("heading", { name: "Top gainers" }).closest("div")!.parentElement!,
    );
    const gainerLinks = gainers.getAllByRole("link").map((a) => a.textContent);
    expect(gainerLinks[0]).toContain("Bravo");
    expect(gainerLinks[1]).toContain("Alpha");

    const losers = within(
      screen.getByRole("heading", { name: "Top losers" }).closest("div")!.parentElement!,
    );
    const loserLinks = losers.getAllByRole("link");
    expect(loserLinks[0]).toHaveTextContent("Charlie");
    expect(loserLinks[0]).toHaveAttribute("href", "/coin/charlie");
    expect(loserLinks[1]).toHaveTextContent("Delta");
  });

  it("shows signed, directional changes", () => {
    renderWithClient(<MoversSection />, (c) =>
      c.setQueryData(queryKeys.markets(), mixed),
    );
    expect(screen.getByText("+12.00%")).toBeInTheDocument();
    expect(screen.getByText("-6.00%")).toBeInTheDocument();
  });

  it("shows an empty state for a side with no movers instead of a blank card", () => {
    renderWithClient(<MoversSection />, (c) =>
      c.setQueryData(queryKeys.markets(), [makeCoin({ id: "alpha", change24h: 3 })]),
    );
    expect(screen.getByText("No movers right now")).toBeInTheDocument(); // the losers side
  });

  it("shows loading placeholders for both lists while fetching", () => {
    mockApi({ "/api/markets": "pending" });
    renderWithClient(<MoversSection />);
    expect(screen.getAllByRole("status", { name: "Loading movers" })).toHaveLength(2);
  });

  it("shows a retryable error when the request fails", async () => {
    mockApi({ "/api/markets": "fail" });
    renderWithClient(<MoversSection />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load market movers",
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
