import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeCoin } from "@/test/fixtures";
import { CompareStats, type StatsAsset } from "./compare-stats";

const btc: StatsAsset = {
  id: "bitcoin",
  color: 0,
  name: "Bitcoin",
  image: null,
  coin: makeCoin({
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    rank: 1,
    price: 67000,
    marketCap: 1.3e12,
    volume24h: 3e10,
    high24h: 68000,
    low24h: 66000,
    circulatingSupply: 19_700_000,
    change24h: 1.5,
    change7d: -2,
  }),
  change: 8.25,
  loading: false,
};
const eth: StatsAsset = {
  ...btc,
  id: "ethereum",
  color: 7,
  name: "Ethereum",
  coin: makeCoin({
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    rank: 2,
    price: 3200,
    marketCap: 4e11,
    volume24h: 1.5e10,
    high24h: 3300,
    low24h: 3100,
    circulatingSupply: 120_000_000,
    change24h: -0.5,
    change7d: 4,
  }),
  change: -1.1,
};

const rowOf = (label: string | RegExp) =>
  screen.getByRole("row", {
    name: (name) =>
      typeof label === "string" ? name.startsWith(label) : label.test(name),
  });

describe("CompareStats", () => {
  it("has one column per asset, in the order given, each linking to its page", () => {
    render(<CompareStats assets={[btc, eth]} range="7d" />);
    const headers = screen.getAllByRole("columnheader");
    // [figure label column, Bitcoin, Ethereum]
    expect(headers).toHaveLength(3);
    expect(within(headers[1]!).getByRole("link", { name: /Bitcoin/ })).toHaveAttribute(
      "href",
      "/coin/bitcoin",
    );
    expect(within(headers[2]!).getByRole("link", { name: /Ethereum/ })).toHaveAttribute(
      "href",
      "/coin/ethereum",
    );
  });

  it("has a caption and row headers, so a screen reader can read it as a table", () => {
    render(<CompareStats assets={[btc, eth]} range="7d" />);
    expect(screen.getByRole("table", { name: /key figures/i })).toBeVisible();
    expect(screen.getAllByRole("rowheader").length).toBeGreaterThanOrEqual(10);
  });

  it("shows each asset's figures in its own column", () => {
    render(<CompareStats assets={[btc, eth]} range="7d" />);
    const price = rowOf("Price");
    expect(
      within(price)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["$67,000.00", "$3,200.00"]);
    expect(
      within(rowOf("Rank"))
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["#1", "#2"]);
    expect(
      within(rowOf("Circulating supply"))
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["19.7M BTC", "120M ETH"]);
  });

  it("names the range in the first row", () => {
    const { rerender } = render(<CompareStats assets={[btc, eth]} range="7d" />);
    expect(rowOf("On the chart, 7 days")).toBeVisible();
    // ...and the market figure of the same name stays a different row.
    expect(rowOf("Change, 7 days")).toBeVisible();
    expect(
      within(screen.getAllByRole("row")[1]!)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["+8.25%up", "-1.10%down"]); // the arrows carry a screen-reader word
    rerender(<CompareStats assets={[btc, eth]} range="1y" />);
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("On the chart, 1 year");
  });

  it("shows placeholders while the market data loads, but already has the range change", () => {
    render(
      <CompareStats assets={[{ ...btc, coin: undefined, loading: true }]} range="30d" />,
    );
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("+8.25%"); // from the chart
    expect(screen.queryByText("$67,000.00")).toBeNull();
  });

  it("marks figures it can't show as unavailable instead of leaving a blank", () => {
    render(
      <CompareStats
        assets={[{ ...btc, coin: undefined, loading: false, change: null }]}
        range="7d"
      />,
    );
    expect(within(rowOf("Price")).getByText("unavailable")).toBeInTheDocument();
  });

  it("is a positioned scroller, so hidden screen-reader text can't widen the page on phones", () => {
    render(<CompareStats assets={[btc, eth]} range="7d" />);
    const scroller = screen.getByRole("table").parentElement!;
    expect(scroller).toHaveClass("relative", "overflow-x-auto");
  });

  it("keeps the figure names in view while the table scrolls sideways", () => {
    render(<CompareStats assets={[btc, eth]} range="7d" />);
    for (const header of screen.getAllByRole("rowheader")) {
      expect(header).toHaveClass("sticky", "left-0", "bg-primary");
    }
  });
});
