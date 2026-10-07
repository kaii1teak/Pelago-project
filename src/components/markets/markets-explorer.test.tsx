import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import { useWatchlistStore } from "@/stores/watchlist";
import { makeCoin } from "@/test/fixtures";
import {
  installHistoryMock,
  navigateExternally,
  uninstallHistoryMock,
} from "@/test/navigation";
import { renderWithClient } from "@/test/render";
import { MarketsExplorer } from "./markets-explorer";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);

// 60 coins: even numbers gained, odd numbers lost; prices are a permutation so
// price order differs from rank order.
const COINS = Array.from({ length: 60 }, (_, i) => {
  const n = i + 1;
  return makeCoin({
    id: `coin${n}`,
    name: `Coin ${n}`,
    symbol: `C${n}`,
    rank: n,
    price: ((n * 37) % 61) * 10 + 5,
    marketCap: 1e9 - n * 1e6,
    change24h: n % 2 === 0 ? n / 10 : -n / 10,
  });
});
const label = (c: { name: string; symbol: string }) => `${c.name}${c.symbol}`;

const bodyRows = () => screen.getAllByRole("row").slice(1);
// The row link also holds a decorative (aria-hidden) letter avatar; read what a user reads.
const textOf = (link: HTMLElement) => {
  const clone = link.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove());
  return clone.textContent;
};
const visibleLabels = () =>
  bodyRows().map((row) => textOf(within(row).getByRole("link")));
const search = () => window.location.search;

let user: ReturnType<typeof userEvent.setup>;

function setup(url = "/markets", seed = true) {
  window.history.replaceState(null, "", url);
  return renderWithClient(<MarketsExplorer />, (client) => {
    if (seed) client.setQueryData(queryKeys.markets(), COINS);
  });
}
const settle = (ms: number) =>
  act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  installHistoryMock();
  localStorage.clear();
  useWatchlistStore.setState({ ids: [] });
  vi.useFakeTimers({ shouldAdvanceTime: true });
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
});
afterEach(() => {
  uninstallHistoryMock();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MarketsExplorer: table", () => {
  it("shows the first page in market-cap order, with a summary", () => {
    setup();
    expect(bodyRows()).toHaveLength(25);
    expect(visibleLabels()[0]).toBe(label(COINS[0]!));
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1–25 of 60 assets");
  });

  it("has an accessible name for the table", () => {
    setup();
    expect(
      screen.getByRole("table", { name: /cryptocurrencies by market cap/i }),
    ).toBeInTheDocument();
  });

  it("sorts on click, flips on the second click, and mirrors it in aria-sort and the URL", async () => {
    setup();
    const priceHeader = () => screen.getByRole("columnheader", { name: /price/i });
    expect(priceHeader()).toHaveAttribute("aria-sort", "none");

    await user.click(within(priceHeader()).getByRole("button"));
    const byPriceDesc = [...COINS].sort((a, b) => b.price! - a.price!);
    expect(priceHeader()).toHaveAttribute("aria-sort", "descending");
    expect(visibleLabels()[0]).toBe(label(byPriceDesc[0]!));
    expect(search()).toBe("?sort=price");

    await user.click(within(priceHeader()).getByRole("button"));
    const byPriceAsc = [...COINS].sort((a, b) => a.price! - b.price!);
    expect(priceHeader()).toHaveAttribute("aria-sort", "ascending");
    expect(visibleLabels()[0]).toBe(label(byPriceAsc[0]!));
    expect(search()).toBe("?sort=price&dir=asc");
  });

  it("only one column is sorted at a time", async () => {
    setup();
    await user.click(
      within(screen.getByRole("columnheader", { name: /price/i })).getByRole("button"),
    );
    await user.click(
      within(screen.getByRole("columnheader", { name: /^name/i })).getByRole("button"),
    );
    const sorted = screen
      .getAllByRole("columnheader")
      .filter((h) =>
        ["ascending", "descending"].includes(h.getAttribute("aria-sort") ?? ""),
      );
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toHaveTextContent(/name/i);
  });

  it("restores a view from a shared link", () => {
    setup("/markets?sort=price&dir=asc");
    const byPriceAsc = [...COINS].sort((a, b) => a.price! - b.price!);
    expect(visibleLabels()[0]).toBe(label(byPriceAsc[0]!));
    expect(screen.getByRole("columnheader", { name: /price/i })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("starring a row saves it without disturbing the order", async () => {
    setup();
    const before = visibleLabels();
    await user.click(screen.getByRole("button", { name: "Watch Coin 3" }));
    expect(screen.getByRole("button", { name: "Watch Coin 3" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(useWatchlistStore.getState().ids).toEqual(["coin3"]);
    expect(visibleLabels()).toEqual(before);
  });
});

describe("MarketsExplorer: search", () => {
  it("is debounced, case-insensitive, and written to the URL", async () => {
    setup();
    await user.type(screen.getByRole("searchbox", { name: "Search assets" }), "COIN 7");

    // Typing alone changes nothing yet.
    expect(bodyRows()).toHaveLength(25);
    expect(search()).toBe("");

    await settle(300);
    expect(visibleLabels()).toEqual([label(COINS[6]!)]);
    expect(search()).toBe("?q=COIN+7");
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1–1 of 1 assets");
  });

  it("matches symbols too", async () => {
    setup();
    await user.type(screen.getByRole("searchbox"), "c12");
    await settle(300);
    expect(visibleLabels()).toEqual([label(COINS[11]!)]);
  });

  it("the clear button resets instantly (no debounce wait)", async () => {
    setup();
    await user.type(screen.getByRole("searchbox"), "coin 7");
    await settle(300);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    // The clear button disappears; focus must land back in the box, not on <body>.
    expect(screen.getByRole("searchbox")).toHaveFocus();
    expect(bodyRows()).toHaveLength(25);
    expect(search()).toBe("");
  });

  it("follows Back/Forward: the box and rows update when the URL changes under it", async () => {
    setup();
    await user.type(screen.getByRole("searchbox"), "coin 7");
    await settle(300);
    expect(bodyRows()).toHaveLength(1);

    act(() => navigateExternally("/markets"));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(bodyRows()).toHaveLength(25);
  });

  it("pressing Back mid-debounce is not undone by the pending text", async () => {
    setup();
    await user.type(screen.getByRole("searchbox"), "zzz"); // typed, not yet committed
    act(() => navigateExternally("/markets?q=coin+5")); // ...then Back/Forward lands elsewhere
    expect(screen.getByRole("searchbox")).toHaveValue("coin 5");

    await settle(600); // the old debounce timer would have fired by now
    expect(search()).toBe("?q=coin+5");
    expect(screen.getByRole("searchbox")).toHaveValue("coin 5");
    expect(visibleLabels().every((l) => l!.toLowerCase().includes("coin 5"))).toBe(true);
  });

  it("shows an empty state with a way out when nothing matches", async () => {
    setup();
    await user.type(screen.getByRole("searchbox"), "qqqq");
    await settle(300);
    expect(screen.getByText("No assets match “qqqq”")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(bodyRows()).toHaveLength(25);
    expect(search()).toBe("");
  });
});

describe("MarketsExplorer: filters", () => {
  it("Gainers shows only risers, biggest first", async () => {
    setup();
    await user.click(screen.getByRole("button", { name: "Gainers" }));
    expect(screen.getByRole("button", { name: "Gainers" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("of 30 assets");
    expect(visibleLabels()[0]).toBe(label(COINS[59]!)); // coin60: +6.0%
    expect(search()).toContain("view=gainers");
    expect(screen.getByRole("columnheader", { name: /^24h$/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("Losers shows only fallers, worst first", async () => {
    setup();
    await user.click(screen.getByRole("button", { name: "Losers" }));
    expect(screen.getByRole("status")).toHaveTextContent("of 30 assets");
    expect(visibleLabels()[0]).toBe(label(COINS[58]!)); // coin59: -5.9%
  });

  it("switching back to All restores rank order", async () => {
    setup();
    await user.click(screen.getByRole("button", { name: "Gainers" }));
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(visibleLabels()[0]).toBe(label(COINS[0]!));
    expect(search()).toBe("");
  });

  it("a category fetches its own list and keeps the old rows dimmed while loading", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn<typeof fetch>(
      () => new Promise<Response>((r) => (resolve = r)),
    );
    vi.stubGlobal("fetch", fetchMock);
    setup();

    await user.click(screen.getByRole("button", { name: "DeFi" }));
    expect(screen.getByRole("button", { name: "DeFi" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "/api/markets?category=decentralized-finance-defi",
    );
    expect(search()).toBe("?category=decentralized-finance-defi");

    // Old rows stay on screen (no skeleton flash), marked busy.
    expect(screen.queryByRole("status", { name: "Loading markets" })).toBeNull();
    expect(bodyRows()).toHaveLength(25);
    expect(screen.getByRole("table").parentElement).toHaveAttribute("aria-busy", "true");

    const defi = [makeCoin({ id: "uniswap", name: "Uniswap", symbol: "UNI", rank: 1 })];
    await act(async () => resolve(new Response(JSON.stringify(defi))));
    await waitFor(() => expect(visibleLabels()).toEqual(["UniswapUNI"]));
    expect(screen.getByRole("table").parentElement).toHaveAttribute("aria-busy", "false");
  });
});

describe("MarketsExplorer: pagination", () => {
  it("pages forward and back, updating rows, summary, URL and scroll position", async () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    setup();

    await user.click(screen.getByRole("button", { name: "Page 2" }));
    expect(visibleLabels()[0]).toBe(label(COINS[25]!));
    expect(screen.getByRole("status")).toHaveTextContent("Showing 26–50 of 60 assets");
    expect(search()).toBe("?page=2");
    expect(scroll).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Page 1" }));
    expect(search()).toBe("");
  });

  it("changing the sort or filter returns to page 1", async () => {
    setup("/markets?page=3");
    expect(bodyRows()).toHaveLength(10);
    await user.click(
      within(screen.getByRole("columnheader", { name: /price/i })).getByRole("button"),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1–25");
    expect(search()).not.toContain("page");
  });

  it("corrects an out-of-range page in the URL", async () => {
    setup("/markets?page=99");
    expect(screen.getByRole("status")).toHaveTextContent("Showing 51–60 of 60 assets");
    await waitFor(() => expect(search()).toBe("?page=3"));
  });
});

describe("MarketsExplorer: loading and errors", () => {
  it("shows a loading state while the first request is in flight", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    setup("/markets", false);
    expect(screen.getByRole("status", { name: "Loading markets" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    // The toolbar is usable while loading.
    expect(screen.getByRole("searchbox")).toBeEnabled();
  });

  it("shows a retryable error, and recovers when the retry succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "upstream_error", message: "x" } }),
          { status: 502 },
        ),
      )
      .mockResolvedValue(new Response(JSON.stringify(COINS)));
    vi.stubGlobal("fetch", fetchMock);
    setup("/markets", false);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load markets");
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(bodyRows()).toHaveLength(25));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
