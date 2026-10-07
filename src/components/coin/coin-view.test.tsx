import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coinDetailSchema } from "@/lib/api/schemas";
import { queryKeys } from "@/lib/api/query-keys";
import { coinFixture } from "@/test/fixtures";
import { installHistoryMock, uninstallHistoryMock } from "@/test/navigation";
import { mockApi, renderWithClient } from "@/test/render";
import { useWatchlistStore } from "@/stores/watchlist";
import { CoinView } from "./coin-view";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="chart" /> }));

const coin = coinDetailSchema.parse(coinFixture);
const seeded = () =>
  renderWithClient(<CoinView id="bitcoin" />, (c) => {
    c.setQueryData(queryKeys.coin("bitcoin"), coin);
    c.setQueryData(queryKeys.coinChart("bitcoin", "7d"), [
      { time: 1, value: 1 },
      { time: 2, value: 2 },
    ]);
  });

beforeEach(() => {
  installHistoryMock();
  window.history.replaceState(null, "", "/coin/bitcoin");
  localStorage.clear();
  useWatchlistStore.setState({ ids: [] });
});
afterEach(() => {
  uninstallHistoryMock();
  vi.unstubAllGlobals();
});

describe("CoinView: markup", () => {
  it("keeps every <dl> valid: groups hold only dt/dd, and nothing is outside a <dl>", () => {
    const { container } = seeded();
    const lists = container.querySelectorAll("dl");
    expect(lists.length).toBeGreaterThan(0);
    for (const dl of lists) {
      for (const child of dl.children) {
        if (child.tagName === "DIV") {
          // A group: only terms and descriptions (Lighthouse "definition-list").
          for (const inner of child.children)
            expect(["DT", "DD"]).toContain(inner.tagName);
        } else {
          expect(["DT", "DD"]).toContain(child.tagName);
        }
      }
    }
    for (const item of container.querySelectorAll("dt, dd")) {
      expect(item.closest("dl")).not.toBeNull();
    }
  });
});

describe("CoinView: loaded", () => {
  it("renders the header, chart, stats, about and links as labelled sections", () => {
    seeded();
    expect(
      screen.getByRole("heading", { level: 1, name: "Bitcoin" }),
    ).toBeInTheDocument();
    for (const name of [
      "Price chart",
      "Bitcoin by the numbers",
      "What is Bitcoin?",
      "Around the web",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("shows the price, 24h change (with direction in text) and rank", () => {
    seeded();
    const header = screen.getByRole("heading", { level: 1 }).closest("header")!;
    expect(within(header).getByText("$83,753.00")).toBeInTheDocument();
    expect(within(header).getByText("-2.77%")).toBeInTheDocument();
    expect(within(header).getByText("down")).toBeInTheDocument();
    expect(within(header).getByText("Rank #1")).toBeInTheDocument();
  });

  it("has a breadcrumb back to Markets, with the current page marked", () => {
    seeded();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Markets" })).toHaveAttribute(
      "href",
      "/markets",
    );
    expect(within(crumbs).getByText("Bitcoin")).toHaveAttribute("aria-current", "page");
  });

  it("the watch button adds this coin to the watchlist", async () => {
    seeded();
    await userEvent.click(screen.getByRole("button", { name: "Watch Bitcoin" }));
    expect(useWatchlistStore.getState().ids).toEqual(["bitcoin"]);
  });
});

describe("CoinView: key stats", () => {
  it("lists the main figures", () => {
    seeded();
    const stats = screen.getByRole("region", { name: "Bitcoin by the numbers" });
    const text = stats.textContent!;
    expect(text).toContain("$1.68T"); // market cap
    expect(text).toContain("$35.8B"); // volume
    expect(text).toContain("20.09M"); // circulating
    expect(text).toContain("21M"); // max supply
    expect(text).toContain("$126,080.00"); // ATH
    expect(text).toContain("Oct 6, 2025");
    expect(text).toContain("Jan 3, 2009"); // launched
  });

  it("shows the 24h range with the price marked on it, readable without sight", () => {
    seeded();
    const bar = screen.getByRole("img", { name: /24 hour low/i });
    expect(bar).toHaveAccessibleName(
      /\$83,753\.00 is \d+ percent of the way from the 24 hour low \$83,610\.00 to the high \$86,648\.00/,
    );
  });

  it("shows a dash, not zero, for supplies that don't exist", () => {
    renderWithClient(<CoinView id="bitcoin" />, (c) => {
      c.setQueryData(
        queryKeys.coin("bitcoin"),
        coinDetailSchema.parse({
          ...coinFixture,
          market_data: { ...coinFixture.market_data, max_supply: null },
        }),
      );
      c.setQueryData(queryKeys.coinChart("bitcoin", "7d"), []);
    });
    const row = screen.getByText("Max supply").closest("div")!;
    expect(row).toHaveTextContent("—");
    expect(row).not.toHaveTextContent("0");
  });
});

describe("CoinView: about and links", () => {
  it("renders the description as plain text paragraphs, with categories", () => {
    seeded();
    const about = screen.getByRole("region", { name: "What is Bitcoin?" });
    expect(
      within(about).getByText(/first decentralized cryptocurrency/),
    ).toBeInTheDocument();
    expect(about.querySelector("a, script, b")).toBeNull();
    expect(within(about).getByRole("list", { name: "Categories" })).toBeInTheDocument();
    expect(within(about).getAllByRole("listitem")).toHaveLength(3);
  });

  it("collapses a long description and expands on request", async () => {
    const long = "A".repeat(200);
    renderWithClient(<CoinView id="bitcoin" />, (c) => {
      c.setQueryData(
        queryKeys.coin("bitcoin"),
        coinDetailSchema.parse({
          ...coinFixture,
          description: { en: `${long}\n\n${long}\n\n${long}` },
        }),
      );
      c.setQueryData(queryKeys.coinChart("bitcoin", "7d"), []);
    });
    const toggle = screen.getByRole("button", { name: "Read more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toHaveClass(
      "line-clamp-5",
    );

    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      document.getElementById(toggle.getAttribute("aria-controls")!),
    ).not.toHaveClass("line-clamp-5");
  });

  it("a short description has no toggle", () => {
    renderWithClient(<CoinView id="bitcoin" />, (c) => {
      c.setQueryData(
        queryKeys.coin("bitcoin"),
        coinDetailSchema.parse({ ...coinFixture, description: { en: "Short." } }),
      );
      c.setQueryData(queryKeys.coinChart("bitcoin", "7d"), []);
    });
    expect(screen.queryByRole("button", { name: /read more/i })).toBeNull();
  });

  it("external links open safely in a new tab and say so", () => {
    seeded();
    const links = screen.getByRole("region", { name: "Around the web" });
    const anchors = within(links).getAllByRole("link");
    expect(anchors.length).toBeGreaterThanOrEqual(6);
    for (const a of anchors) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
      expect(a.getAttribute("rel")).toContain("noreferrer");
      expect(a.getAttribute("href")).toMatch(/^https?:\/\//);
      expect(within(a).getByText("(opens in a new tab)")).toBeInTheDocument();
    }
    expect(
      within(links).getByRole("link", { name: /Website.*bitcoin\.org/ }),
    ).toHaveAttribute("href", "http://www.bitcoin.org/");
  });

  it("never renders a javascript: link, even though the payload contained one", () => {
    seeded();
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.startsWith("javascript:"))).toBe(false);
  });

  it("omits sections that have nothing to show", () => {
    renderWithClient(<CoinView id="bitcoin" />, (c) => {
      c.setQueryData(
        queryKeys.coin("bitcoin"),
        coinDetailSchema.parse({ id: "bitcoin", symbol: "btc", name: "Bitcoin" }),
      );
      c.setQueryData(queryKeys.coinChart("bitcoin", "7d"), []);
    });
    expect(screen.queryByRole("heading", { name: "Around the web" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "What is Bitcoin?" })).toBeNull();
  });
});

describe("CoinView: not loaded", () => {
  it("shows a loading skeleton while the coin is in flight", () => {
    mockApi({ "/api/coins/bitcoin": "pending" });
    renderWithClient(<CoinView id="bitcoin" />);
    expect(screen.getByRole("status", { name: "Loading asset" })).toBeInTheDocument();
  });

  it("explains a missing asset (client-side navigation to a bad id)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "not_found", message: "x" } }), {
            status: 404,
          }),
      ),
    );
    renderWithClient(<CoinView id="nope" />);
    expect(await screen.findByText("We couldn't find that asset")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse markets" })).toHaveAttribute(
      "href",
      "/markets",
    );
    // Nothing to retry: a missing coin stays missing.
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("shows a retryable error for anything else", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "rate_limited", message: "Slow down", retryAfter: 30 },
          }),
          { status: 429 },
        ),
      )
      .mockResolvedValue(new Response(JSON.stringify(coin)));
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<CoinView id="bitcoin" />, (c) =>
      c.setQueryData(queryKeys.coinChart("bitcoin", "7d"), []),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load this asset",
    );
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Bitcoin" }),
    ).toBeInTheDocument();
  });
});
