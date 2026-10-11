import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import { makeCoin } from "@/test/fixtures";
import { renderWithClient } from "@/test/render";
import { TICKER_REQUEST, TickerTape } from "./ticker-tape";

/**
 * The strip is for every page but the home page, and which page this is must come from the
 * route that is rendered, not from the URL's text. A server can render a prerendered page
 * under a different path than the browser shows (Vercel did, for the home page), and a
 * strip drawn by the server but not by the browser is left behind above the page for good.
 * So here the URL lies, and the strip must still do the right thing.
 */
const route = vi.hoisted(() => ({ path: "/", segment: null as string | null }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.path,
  useSelectedLayoutSegment: () => route.segment,
}));

const coins = [makeCoin({ id: "bitcoin", name: "Bitcoin", symbol: "BTC", rank: 1 })];
const seeded = () =>
  renderWithClient(<TickerTape />, (client) =>
    client.setQueryData(queryKeys.markets(TICKER_REQUEST), coins),
  );

describe("TickerTape: which page it is on", () => {
  it("stays away from the home page even when the URL reads as something else", () => {
    route.path = "/index";
    route.segment = null;
    const { container } = seeded();
    expect(container).toBeEmptyDOMElement();
  });

  it("is on every other page even when the URL reads as the home page", () => {
    route.path = "/";
    route.segment = "markets";
    seeded();
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("is on a page nested under a segment, such as an asset", () => {
    route.path = "/coin/bitcoin";
    route.segment = "coin";
    seeded();
    expect(screen.getByRole("region")).toBeInTheDocument();
  });
});
