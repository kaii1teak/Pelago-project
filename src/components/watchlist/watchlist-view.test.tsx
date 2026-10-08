import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import type { MarketCoin } from "@/lib/api/schemas";
import type * as WatchlistStore from "@/stores/watchlist";
import { MAX_IDS } from "@/lib/api/markets-query";
import {
  WATCHLIST_STORAGE_KEY,
  useWatchlistHydrated,
  useWatchlistStore,
} from "@/stores/watchlist";
import { makeCoin } from "@/test/fixtures";
import { renderWithClient } from "@/test/render";
import { WatchlistView } from "./watchlist-view";

// Lets one test pretend the saved list has not been read yet.
vi.mock("@/stores/watchlist", async (importOriginal) => {
  const actual = await importOriginal<typeof WatchlistStore>();
  return { ...actual, useWatchlistHydrated: vi.fn(actual.useWatchlistHydrated) };
});
const actualHydrated = (
  await vi.importActual<typeof WatchlistStore>("@/stores/watchlist")
).useWatchlistHydrated;

const BITCOIN = makeCoin({ id: "bitcoin", name: "Bitcoin", rank: 1, price: 67000 });
const ETHEREUM = makeCoin({ id: "ethereum", name: "Ethereum", rank: 2, price: 3200 });
const SOLANA = makeCoin({ id: "solana", name: "Solana", rank: 5, price: 150 });

/** A fetch that answers like /api/markets: only the coins that were asked for. */
function marketsApi(all: readonly MarketCoin[] = [BITCOIN, ETHEREUM, SOLANA]) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const ids = new URL(String(input), "http://test").searchParams.get("ids");
    const wanted = ids ? ids.split(",") : [];
    return new Response(JSON.stringify(all.filter((c) => wanted.includes(c.id))), {
      status: 200,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Saves ids the way a previous visit would have, then reads them back (hydrates). */
async function savedList(ids: string[]) {
  localStorage.setItem(
    WATCHLIST_STORAGE_KEY,
    JSON.stringify({ state: { ids }, version: 1 }),
  );
  await act(async () => {
    await useWatchlistStore.persist.rehydrate();
  });
}

/** The coin ids of the table rows, top to bottom (from each row's link). */
const rowIds = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row).getByRole("link").getAttribute("href")!.slice("/coin/".length),
    );

beforeEach(() => {
  localStorage.clear();
  useWatchlistStore.setState({ ids: [] });
  vi.mocked(useWatchlistHydrated).mockImplementation(actualHydrated);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("WatchlistView: before and without a list", () => {
  it("waits for the saved list instead of flashing 'nothing saved'", async () => {
    marketsApi();
    await savedList(["bitcoin"]);
    vi.mocked(useWatchlistHydrated).mockReturnValue(false);
    renderWithClient(<WatchlistView />);

    expect(screen.getByRole("status", { name: "Loading your watchlist" })).toBeVisible();
    expect(screen.queryByText(/nothing on your watchlist/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
  });

  it("keeps the heading outline sequential: the h1, then an h2 (never a skipped level)", async () => {
    marketsApi();
    await savedList([]);
    renderWithClient(<WatchlistView />);
    const levels = screen.getAllByRole("heading").map((h) => Number(h.tagName[1]));
    expect(levels).toEqual([1, 2]);
  });

  it("invites you to browse when nothing is saved, and asks the API for nothing", async () => {
    const fetchMock = marketsApi();
    await savedList([]);
    renderWithClient(<WatchlistView />);

    expect(screen.getByText("Nothing on your watchlist yet")).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse markets" })).toHaveAttribute(
      "href",
      "/markets",
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("WatchlistView: saved assets", () => {
  it("shows just the saved coins, from one request for exactly those ids", async () => {
    const fetchMock = marketsApi();
    await savedList(["ethereum", "bitcoin"]);
    renderWithClient(<WatchlistView />);

    await screen.findByRole("table");
    expect(rowIds()).toEqual(["bitcoin", "ethereum"]);
    expect(screen.queryByText("Solana")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "/api/markets?ids=bitcoin%2Cethereum",
    );
    expect(screen.getByText("2 assets")).toBeVisible();
  });

  it("counts the assets shown, not saved ids that no longer exist", async () => {
    marketsApi();
    await savedList(["bitcoin", "delisted-coin"]);
    renderWithClient(<WatchlistView />);
    expect(await screen.findByText("1 asset")).toBeVisible();
  });

  it("says '1 asset', not '1 assets'", async () => {
    marketsApi();
    await savedList(["bitcoin"]);
    renderWithClient(<WatchlistView />);
    expect(await screen.findByText("1 asset")).toBeVisible();
  });

  it("holds a skeleton, sized to the list, while the first prices load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() => new Promise<Response>(() => {})),
    );
    await savedList(["bitcoin", "ethereum", "solana"]);
    renderWithClient(<WatchlistView />);

    const skeleton = screen.getByRole("status", { name: "Loading your watchlist" });
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("sorts on a column click, defaulting to rank", async () => {
    marketsApi();
    await savedList(["bitcoin", "ethereum", "solana"]);
    renderWithClient(<WatchlistView />);
    await screen.findByRole("table");
    expect(rowIds()).toEqual(["bitcoin", "ethereum", "solana"]);

    await userEvent.click(screen.getByRole("button", { name: /^price/i }));
    // Price sorts high to low first.
    expect(rowIds()).toEqual(["bitcoin", "ethereum", "solana"]);
    await userEvent.click(screen.getByRole("button", { name: /^price/i }));
    expect(rowIds()).toEqual(["solana", "ethereum", "bitcoin"]);
  });

  it("splits a long list into requests the API accepts, and joins the rows", async () => {
    const many = Array.from({ length: MAX_IDS + 5 }, (_, i) =>
      makeCoin({
        id: `coin${String(i).padStart(3, "0")}`,
        name: `Coin ${i}`,
        rank: i + 1,
      }),
    );
    const fetchMock = marketsApi(many);
    await savedList(many.map((c) => c.id));
    renderWithClient(<WatchlistView />);

    await screen.findByRole("table");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url] of fetchMock.mock.calls) {
      const ids = new URL(String(url), "http://test").searchParams.get("ids")!;
      expect(ids.split(",").length).toBeLessThanOrEqual(MAX_IDS);
    }
    expect(rowIds()).toHaveLength(MAX_IDS + 5);
  });
});

describe("WatchlistView: errors", () => {
  it("shows an error with a retry that recovers", async () => {
    let failing = true;
    const fetchMock = vi.fn<typeof fetch>(async () =>
      failing
        ? new Response(
            JSON.stringify({ error: { code: "upstream_error", message: "x" } }),
            {
              status: 502,
            },
          )
        : new Response(JSON.stringify([BITCOIN]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await savedList(["bitcoin"]);
    renderWithClient(<WatchlistView />);

    expect(await screen.findByText("Couldn't load your watchlist")).toBeVisible();
    expect(screen.queryByRole("table")).toBeNull();

    failing = false;
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("table")).toBeVisible();
    expect(rowIds()).toEqual(["bitcoin"]);
  });

  it("keeps the last prices on screen when a refresh fails, and says so", async () => {
    const fetchMock = marketsApi();
    await savedList(["bitcoin"]);
    const { client } = renderWithClient(<WatchlistView />);
    await screen.findByRole("table");
    expect(screen.getByText(/Live · refreshes every minute/)).toBeVisible();

    fetchMock.mockImplementation(async () => new Response("{}", { status: 502 }));
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.markets({ ids: ["bitcoin"] }) });
    });
    expect(await screen.findByText(/Reconnecting, showing last data/)).toBeVisible();
    expect(rowIds()).toEqual(["bitcoin"]);
  });
});

describe("WatchlistView: removing", () => {
  it("removes an asset instantly, without asking the API again", async () => {
    const fetchMock = marketsApi();
    await savedList(["bitcoin", "ethereum"]);
    renderWithClient(<WatchlistView />);
    await screen.findByRole("table");

    await userEvent.click(screen.getByRole("button", { name: "Watch Bitcoin" }));

    expect(rowIds()).toEqual(["ethereum"]);
    expect(useWatchlistStore.getState().ids).toEqual(["ethereum"]);
    expect(JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY)!).state.ids).toEqual([
      "ethereum",
    ]);
    expect(screen.getByText("1 asset")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("hands keyboard focus to the next row's star, not back to the top of the page", async () => {
    marketsApi();
    await savedList(["bitcoin", "ethereum", "solana"]);
    renderWithClient(<WatchlistView />);
    await screen.findByRole("table");

    const first = screen.getByRole("button", { name: "Watch Bitcoin" });
    first.focus();
    await userEvent.keyboard("{Enter}");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Watch Ethereum" })).toHaveFocus(),
    );
  });

  it("when the selected ROW (j / k) is removed, selects the next row, so j and k carry on", async () => {
    marketsApi();
    await savedList(["bitcoin", "ethereum", "solana"]);
    renderWithClient(<WatchlistView />);
    await screen.findByRole("table");

    const rows = () => screen.getAllByRole("row").slice(1); // minus the header
    rows()[1]!.focus(); // Ethereum is the selected row
    // What the w key does: press the row's star, without moving focus off the row.
    act(() => within(rows()[1]!).getByRole("button", { name: "Watch Ethereum" }).click());

    await waitFor(() => expect(rows()).toHaveLength(2));
    await waitFor(() => expect(rows()[1]).toHaveFocus());
    expect(rows()[1]).toHaveTextContent("Solana");
  });

  it("moves focus to the heading once the last asset is removed", async () => {
    marketsApi();
    await savedList(["bitcoin"]);
    renderWithClient(<WatchlistView />);
    await screen.findByRole("table");

    const star = screen.getByRole("button", { name: "Watch Bitcoin" });
    star.focus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText("Nothing on your watchlist yet")).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "Your watchlist" }),
    ).toHaveFocus();
  });

  it("clears everything only on the second press, and the first press expires", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    marketsApi();
    await savedList(["bitcoin", "ethereum"]);
    renderWithClient(<WatchlistView />);
    await screen.findByRole("table");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("button", { name: "Remove all 2?" })).toBeVisible();
    expect(useWatchlistStore.getState().ids).toHaveLength(2);

    // Left alone, it disarms: a stray click an hour later must not wipe the list.
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.getByRole("button", { name: "Clear all" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    await user.click(screen.getByRole("button", { name: "Remove all 2?" }));
    expect(useWatchlistStore.getState().ids).toEqual([]);
    expect(await screen.findByText("Nothing on your watchlist yet")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });
});

describe("WatchlistView: assets the API no longer has", () => {
  it("lists them with a way out, instead of letting them vanish", async () => {
    marketsApi();
    await savedList(["bitcoin", "delisted-coin"]);
    renderWithClient(<WatchlistView />);

    await screen.findByRole("table");
    expect(rowIds()).toEqual(["bitcoin"]);
    expect(screen.getByText("1 saved asset couldn't be found")).toBeVisible();
    expect(screen.getByText("delisted-coin")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Remove delisted-coin" }));
    expect(useWatchlistStore.getState().ids).toEqual(["bitcoin"]);
    expect(screen.queryByText(/couldn't be found/)).toBeNull();
  });

  it("shows only that list when none of the saved assets exist any more", async () => {
    marketsApi([]);
    await savedList(["gone-a", "gone-b"]);
    renderWithClient(<WatchlistView />);

    expect(await screen.findByText("2 saved assets couldn't be found")).toBeVisible();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("gone-a")).toBeVisible();
    expect(screen.getByText("gone-b")).toBeVisible();
  });
});
