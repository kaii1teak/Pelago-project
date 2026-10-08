import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import type { PaletteAsset } from "@/lib/palette";
import { usePaletteStore } from "@/stores/palette";
import { makeCoin } from "@/test/fixtures";
import { resetRouterCalls, routerCalls } from "@/test/navigation";
import { renderWithClient } from "@/test/render";
import { CommandPalette } from "./command-palette";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);

const TOP = [
  makeCoin({ id: "bitcoin", name: "Bitcoin", symbol: "BTC", rank: 1 }),
  makeCoin({ id: "ethereum", name: "Ethereum", symbol: "ETH", rank: 2 }),
  makeCoin({ id: "bitcoin-cash", name: "Bitcoin Cash", symbol: "BCH", rank: 18 }),
  makeCoin({ id: "solana", name: "Solana", symbol: "SOL", rank: 7 }),
];
const RARE: PaletteAsset = {
  id: "rare-coin",
  name: "Rare Coin",
  symbol: "RARE",
  rank: 3100,
  image: null,
};

type Reply = PaletteAsset[] | "fail" | "pending";
let reply: (q: string) => Reply = () => [];

function searchApi() {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const q = new URL(String(input), "http://test").searchParams.get("q") ?? "";
    const r = reply(q);
    if (r === "pending") return new Promise<Response>(() => {});
    if (r === "fail") {
      return new Response(
        JSON.stringify({ error: { code: "upstream_error", message: "x" } }),
        {
          status: 502,
        },
      );
    }
    return new Response(JSON.stringify(r));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function setup() {
  const fetchMock = searchApi();
  const view = renderWithClient(<CommandPalette />, (client) =>
    client.setQueryData(queryKeys.markets(undefined), TOP),
  );
  return { ...view, fetchMock, user: userEvent.setup() };
}

const openPalette = () => act(() => usePaletteStore.getState().setOpen(true));
const dialog = () => screen.queryByRole("dialog");
const box = () => screen.getByRole("combobox", { name: "Search assets and pages" });
const options = () => screen.getAllByRole("option");
const activeOption = () =>
  options().find((o) => o.getAttribute("aria-selected") === "true");
const searchUrls = (mock: ReturnType<typeof searchApi>) =>
  mock.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith("/api/search"));

beforeEach(() => {
  usePaletteStore.setState({ open: false });
  resetRouterCalls();
  reply = () => [];
  document.documentElement.classList.remove("dark");
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("CommandPalette: opening and closing", () => {
  it("is closed until asked", () => {
    setup();
    expect(dialog()).toBeNull();
  });

  it("opens with Ctrl+K and closes with it again", async () => {
    const { user } = setup();
    await user.keyboard("{Control>}k{/Control}");
    expect(dialog()).toBeInTheDocument();
    await user.keyboard("{Control>}k{/Control}");
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it("opens with Cmd+K", async () => {
    const { user } = setup();
    await user.keyboard("{Meta>}k{/Meta}");
    expect(dialog()).toBeInTheDocument();
  });

  it("opens even while typing in another field", async () => {
    const { user } = setup();
    const field = document.createElement("input");
    document.body.append(field);
    field.focus();
    await user.keyboard("{Control>}k{/Control}");
    expect(dialog()).toBeInTheDocument();
    field.remove();
  });

  it("ignores K with other modifiers, and a bare K", async () => {
    const { user } = setup();
    await user.keyboard("k");
    await user.keyboard("{Control>}{Shift>}k{/Shift}{/Control}");
    await user.keyboard("{Alt>}k{/Alt}");
    expect(dialog()).toBeNull();
  });

  it("works on a non-Latin keyboard layout, where the key's letter is different", () => {
    setup();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "л",
          code: "KeyK",
          ctrlKey: true,
          bubbles: true,
        }),
      );
    });
    expect(dialog()).toBeInTheDocument();
  });

  it("claims the shortcut from the browser", () => {
    setup();
    const event = new KeyboardEvent("keydown", {
      key: "k",
      code: "KeyK",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("closes on Escape", async () => {
    const { user } = setup();
    await openPalette();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it("starts empty every time it is opened", async () => {
    const { user } = setup();
    await openPalette();
    await user.type(box(), "sol");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog()).toBeNull());
    await openPalette();
    expect(box()).toHaveValue("");
  });
});

describe("CommandPalette: focus", () => {
  it("hands focus back to what opened it when closed with Escape", async () => {
    const { user } = setup();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    await openPalette();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog()).toBeNull());
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("hands focus back after the theme is switched too", async () => {
    const { user } = setup();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    await openPalette();
    await user.type(box(), "theme{Enter}");
    await waitFor(() => expect(dialog()).toBeNull());
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("leaves focus alone after choosing a page: it belongs to the page being opened", async () => {
    const { user } = setup();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    await openPalette();
    await user.type(box(), "markets{Enter}");
    await waitFor(() => expect(dialog()).toBeNull());
    expect(routerCalls).toEqual(["/markets"]);
    expect(opener).not.toHaveFocus();
    opener.remove();
  });
});

describe("CommandPalette: accessibility", () => {
  it("is a named dialog with the input focused, as a combobox over a listbox", async () => {
    setup();
    await openPalette();
    expect(screen.getByRole("dialog", { name: "Search" })).toBeVisible();
    expect(box()).toHaveFocus();
    expect(box()).toHaveAttribute("aria-expanded", "true");
    expect(box()).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
    expect(box()).toHaveAttribute("aria-autocomplete", "list");
  });

  it("keeps the scrolling list out of the Tab order", async () => {
    setup();
    await openPalette();
    // The scroller around the listbox (the listbox itself doesn't scroll).
    expect(screen.getByRole("listbox").parentElement).toHaveAttribute("tabindex", "-1");
  });

  it("groups the options under named headings", async () => {
    setup();
    await openPalette();
    const groups = screen.getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("aria-labelledby"))).not.toContain(null);
    expect(screen.getByRole("group", { name: "Pages" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Actions" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Top assets" })).toBeVisible();
  });

  it("announces how many results there are, once it has them", async () => {
    const { user } = setup();
    await openPalette();
    await user.type(box(), "eth");
    expect(await screen.findByText(/1 result, 1 asset\./)).toBeInTheDocument();
  });

  it("says when there are none", async () => {
    const { user } = setup();
    await openPalette();
    await user.type(box(), "zzzz");
    expect(await screen.findByText("No results for “zzzz”.")).toBeVisible();
    expect(screen.queryByRole("option")).toBeNull();
  });
});

describe("CommandPalette: what it shows", () => {
  it("starts as a launchpad: the pages, the theme switch and the top assets", async () => {
    setup();
    await openPalette();
    expect(
      within(screen.getByRole("group", { name: "Pages" })).getAllByRole("option"),
    ).toHaveLength(4);
    expect(screen.getByRole("option", { name: /Switch to dark theme/ })).toBeVisible();
    const top = within(screen.getByRole("group", { name: "Top assets" })).getAllByRole(
      "option",
    );
    expect(top.map((o) => within(o).getByText(/^[A-Z][a-z]/).textContent)).toEqual([
      "Bitcoin",
      "Ethereum",
      "Bitcoin Cash",
      "Solana",
    ]);
  });

  it("filters pages as you type, by the start of a word", async () => {
    const { user } = setup();
    await openPalette();
    await user.type(box(), "wat");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /Watchlist/ })).toBeVisible();
  });

  it("finds the theme switch by what people call it", async () => {
    const { user } = setup();
    await openPalette();
    await user.type(box(), "dark");
    expect(screen.getByRole("option", { name: /Switch to dark theme/ })).toBeVisible();
  });

  it("shows matching top assets instantly, without waiting for the network", async () => {
    const { user, fetchMock } = setup();
    await openPalette();
    await user.type(box(), "b");
    // One character: nothing is requested, yet the top assets already answer.
    expect(screen.getAllByRole("option", { name: /Bitcoin/ }).length).toBeGreaterThan(0);
    expect(searchUrls(fetchMock)).toEqual([]);
  });

  it("puts the exact match first, then the bigger assets", async () => {
    const { user } = setup();
    await openPalette();
    await user.type(box(), "bitcoin");
    const names = within(screen.getByRole("group", { name: "Assets" }))
      .getAllByRole("option")
      .map((o) => within(o).getByText(/^Bitcoin/).textContent);
    expect(names).toEqual(["Bitcoin", "Bitcoin Cash"]);
  });
});

describe("CommandPalette: searching the whole market", () => {
  it("asks the API once, for the final text, after typing pauses", async () => {
    reply = () => [];
    const { user, fetchMock } = setup();
    await openPalette();
    await user.type(box(), "rare");
    await waitFor(() => expect(searchUrls(fetchMock)).toHaveLength(1));
    expect(searchUrls(fetchMock)[0]).toBe("/api/search?q=rare");
  });

  it("requests the normalized text, so the same search is the same request", async () => {
    const { user, fetchMock } = setup();
    await openPalette();
    await user.type(box(), "  Bit  COIN ");
    await waitFor(() => expect(searchUrls(fetchMock)).toHaveLength(1));
    expect(searchUrls(fetchMock)[0]).toBe("/api/search?q=bit%20coin");
  });

  it("adds assets from outside the top list", async () => {
    reply = () => [RARE];
    const { user } = setup();
    await openPalette();
    await user.type(box(), "rare");
    expect(await screen.findByRole("option", { name: /Rare Coin/ })).toBeVisible();
  });

  it("lists an asset once when the top list and the search both have it", async () => {
    reply = () => [
      { id: "bitcoin", name: "Bitcoin", symbol: "BTC", rank: 1, image: null },
    ];
    const { user, fetchMock } = setup();
    await openPalette();
    await user.type(box(), "bitcoin");
    await waitFor(() => expect(searchUrls(fetchMock)).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText("Searching…")).toBeNull());
    // Exactly one row is titled "Bitcoin" ("Bitcoin Cash" is a different asset).
    const titled = screen
      .getAllByRole("option")
      .filter((o) => within(o).queryByText("Bitcoin"));
    expect(titled).toHaveLength(1);
  });

  it("keeps the local matches on screen while the remote search is still pending", async () => {
    reply = () => "pending";
    const { user } = setup();
    await openPalette();
    await user.type(box(), "bit");
    expect(screen.getByRole("option", { name: /Bitcoin\b/ })).toBeVisible();
  });

  it("does not keep another text's remote results on screen", async () => {
    const whiteBit: PaletteAsset = {
      id: "whitebit",
      name: "WhiteBIT Coin",
      symbol: "WBT",
      rank: 15,
      image: null,
    };
    reply = (q) => (q === "bit" ? [whiteBit] : "pending");
    const { user } = setup();
    await openPalette();
    await user.type(box(), "bit");
    expect(await screen.findByRole("option", { name: /WhiteBIT/ })).toBeVisible();

    await user.type(box(), "c"); // "bitc": WhiteBIT no longer matches
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: /WhiteBIT/ })).toBeNull(),
    );
    expect(screen.getByRole("option", { name: /Bitcoin\b/ })).toBeVisible();
  });

  it("falls back to the top assets, and says so, when the search fails", async () => {
    reply = () => "fail";
    const { user } = setup();
    await openPalette();
    await user.type(box(), "bitcoin");
    expect(
      await screen.findByText(/Couldn.t search every asset right now/),
    ).toBeVisible();
    expect(screen.getByRole("option", { name: /^Bitcoin\b/ })).toBeVisible();
  });
});

describe("CommandPalette: moving and choosing", () => {
  it("highlights the first option, and moves with the arrow keys (wrapping), announced via aria-activedescendant", async () => {
    const { user } = setup();
    await openPalette();
    const all = options();
    expect(activeOption()).toBe(all[0]);
    expect(box()).toHaveAttribute("aria-activedescendant", all[0]!.id);

    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toBe(all[1]);
    expect(box()).toHaveAttribute("aria-activedescendant", all[1]!.id);

    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(activeOption()).toBe(all.at(-1));
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toBe(all[0]);
  });

  it("jumps to the first and last with Home and End", async () => {
    const { user } = setup();
    await openPalette();
    const all = options();
    await user.keyboard("{End}");
    expect(activeOption()).toBe(all.at(-1));
    await user.keyboard("{Home}");
    expect(activeOption()).toBe(all[0]);
  });

  it("follows the pointer", async () => {
    const { user } = setup();
    await openPalette();
    await user.hover(options()[2]!);
    expect(activeOption()).toBe(options()[2]);
  });

  it("starts from the top again when the text changes", async () => {
    const { user } = setup();
    await openPalette();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await user.type(box(), "b");
    expect(activeOption()).toBe(options()[0]);
  });

  it("opens the highlighted asset on Enter and closes", async () => {
    const { user } = setup();
    await openPalette();
    await user.type(box(), "eth");
    await user.keyboard("{Enter}");
    expect(routerCalls).toEqual(["/coin/ethereum"]);
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it("opens a page on Enter", async () => {
    const { user } = setup();
    await openPalette();
    await user.type(box(), "comp");
    await user.keyboard("{Enter}");
    expect(routerCalls).toEqual(["/compare"]);
  });

  it("opens an asset with a click", async () => {
    const { user } = setup();
    await openPalette();
    await user.click(screen.getByRole("option", { name: /Solana/ }));
    expect(routerCalls).toEqual(["/coin/solana"]);
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it("opens the selected asset's page by id, even if the name is unusual", async () => {
    reply = () => [
      { id: "weird-id", name: "Ünicode ₿", symbol: "UNI", rank: null, image: null },
    ];
    const { user } = setup();
    await openPalette();
    await user.type(box(), "unicode");
    await user.click(await screen.findByRole("option", { name: /Ünicode/ }));
    expect(routerCalls).toEqual(["/coin/weird-id"]);
  });

  it("does nothing on Enter when there is nothing to open", async () => {
    const { user } = setup();
    await openPalette();
    await user.type(box(), "zzzz{Enter}");
    expect(routerCalls).toEqual([]);
    expect(dialog()).toBeInTheDocument();
  });

  it("switches the theme from the palette, closes, and goes nowhere", async () => {
    const { user } = setup();
    await openPalette();
    await user.type(box(), "theme");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(dialog()).toBeNull());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(routerCalls).toEqual([]);

    await openPalette();
    expect(screen.getByRole("option", { name: /Switch to light theme/ })).toBeVisible();
  });
});
