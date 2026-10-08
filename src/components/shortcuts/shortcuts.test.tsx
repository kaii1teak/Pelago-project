import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketsTable } from "@/components/markets/markets-table";
import { GROUPS, GROUP_LABEL, HOTKEYS } from "@/lib/hotkeys/catalog";
import { HotkeysProvider } from "@/providers/hotkeys-provider";
import { useHotkeysStore, HOTKEYS_STORAGE_KEY } from "@/stores/hotkeys";
import { usePaletteStore } from "@/stores/palette";
import { useWatchlistStore } from "@/stores/watchlist";
import { makeCoin } from "@/test/fixtures";
import { resetRouterCalls, routerCalls } from "@/test/navigation";
import { renderWithClient } from "@/test/render";
import { ShortcutsButton } from "./shortcuts-button";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);

const root = document.documentElement;

/** A key press reaching the window, the way the browser delivers it. */
function press(
  key: string,
  init: KeyboardEventInit = {},
  target: Element = document.body,
) {
  const code = /^[a-z]$/i.test(key)
    ? `Key${key.toUpperCase()}`
    : /^\d$/.test(key)
      ? `Digit${key}`
      : key;
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        code,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}

function setup(extra?: React.ReactNode) {
  return renderWithClient(
    <>
      <HotkeysProvider />
      {extra}
    </>,
  );
}

beforeEach(() => {
  resetRouterCalls();
  root.classList.remove("dark");
  localStorage.clear();
  useHotkeysStore.setState({
    enabled: true,
    pending: null,
    overlayOpen: false,
    opener: null,
  });
  usePaletteStore.setState({ open: false, opener: null });
  useWatchlistStore.setState({ ids: [] });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("going places: g, then a letter", () => {
  it.each([
    ["h", "/"],
    ["m", "/markets"],
    ["w", "/watchlist"],
    ["c", "/compare"],
  ])("g %s goes to %s", (second, path) => {
    setup();
    press("g");
    expect(routerCalls).toEqual([]);
    press(second);
    expect(routerCalls).toEqual([path]);
  });

  it("works on the Russian layout (п о, where g m would be)", () => {
    setup();
    press("п", { code: "KeyG" });
    press("ь", { code: "KeyM" });
    expect(routerCalls).toEqual(["/markets"]);
  });

  it("shows what can come after g, and takes the hint away again", () => {
    vi.useFakeTimers();
    setup();
    press("g");
    const hint = screen.getByRole("status");
    for (const label of [
      "Go to Home",
      "Go to Markets",
      "Go to Watchlist",
      "Go to Compare",
    ]) {
      expect(within(hint).getByText(label)).toBeInTheDocument();
    }
    act(() => void vi.advanceTimersByTime(1100));
    expect(screen.queryByText("Go to Markets")).toBeNull();
  });

  it("drops the half-typed sequence on a click", () => {
    setup();
    press("g");
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(screen.queryByText("Go to Markets")).toBeNull();
    press("m");
    expect(routerCalls).toEqual([]);
  });
});

describe("single keys", () => {
  it("t switches the theme", () => {
    setup();
    press("t");
    expect(root.classList.contains("dark")).toBe(true);
    press("t");
    expect(root.classList.contains("dark")).toBe(false);
  });

  it("/ focuses the page's search field, selecting what is in it", () => {
    // jsdom has no layout: say the field is on screen (the real one is, or it would be hidden).
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 200,
      height: 40,
    } as DOMRect);
    setup(<input data-hotkey-search aria-label="page search" defaultValue="btc" />);
    press("/");
    const field = screen.getByLabelText("page search") as HTMLInputElement;
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(3);
    expect(usePaletteStore.getState().open).toBe(false);
  });

  it("/ opens the palette on a page with no search field of its own", () => {
    setup();
    press("/");
    expect(usePaletteStore.getState().open).toBe(true);
  });

  it("Ctrl+K and Cmd+K toggle the palette", () => {
    setup();
    press("k", { ctrlKey: true });
    expect(usePaletteStore.getState().open).toBe(true);
    press("k", { metaKey: true });
    expect(usePaletteStore.getState().open).toBe(false);
  });

  it("do nothing while typing in a field, except Ctrl+K", () => {
    setup(<input aria-label="any field" />);
    const field = screen.getByLabelText("any field");
    (field as HTMLInputElement).focus();
    press("t", {}, field);
    press("g", {}, field);
    press("m", {}, field);
    press("?", {}, field);
    expect(root.classList.contains("dark")).toBe(false);
    expect(routerCalls).toEqual([]);
    expect(useHotkeysStore.getState().overlayOpen).toBe(false);
    press("k", { ctrlKey: true }, field);
    expect(usePaletteStore.getState().open).toBe(true);
  });

  it("do nothing while a dialog is open", () => {
    setup();
    act(() => usePaletteStore.getState().setOpen(true));
    // a dialog now exists only if the palette is mounted; stand one in
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    press("t");
    expect(root.classList.contains("dark")).toBe(false);
    dialog.remove();
  });

  it("leave browser shortcuts alone (Ctrl+T, Cmd+J, Alt+G)", () => {
    setup();
    press("t", { ctrlKey: true });
    press("g", { altKey: true });
    press("m", { metaKey: true });
    expect(root.classList.contains("dark")).toBe(false);
    expect(routerCalls).toEqual([]);
  });
});

describe("the shortcuts overlay", () => {
  it("opens with ? and lists every shortcut, grouped", () => {
    setup();
    press("?", { shiftKey: true });
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    for (const group of GROUPS) {
      expect(
        within(dialog).getByRole("heading", { name: GROUP_LABEL[group] }),
      ).toBeVisible();
    }
    for (const hotkey of HOTKEYS) {
      expect(within(dialog).getByText(hotkey.description), hotkey.id).toBeInTheDocument();
    }
  });

  it("shows a sequence as separate keys read as 'then'", () => {
    setup();
    press("?", { shiftKey: true });
    const row = screen.getByText("Go to Markets").closest("li")!;
    expect(within(row).getAllByText(/^[GM]$/)).toHaveLength(2);
    expect(row).toHaveTextContent(/G\s*then\s*M/);
  });

  it("says Ctrl on Windows and Linux, and ⌘ on a Mac", () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
    const first = setup();
    press("?", { shiftKey: true });
    const open = () => screen.getByText("Search assets and pages").closest("li")!;
    expect(open()).toHaveTextContent("Ctrl");
    first.unmount();

    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    act(() => useHotkeysStore.setState({ overlayOpen: false }));
    setup();
    press("?", { shiftKey: true });
    expect(open()).toHaveTextContent("⌘");
    expect(open()).not.toHaveTextContent("Ctrl");
  });

  it("closes with Escape and hands focus back to what had it", async () => {
    const user = userEvent.setup();
    setup(<button>earlier focus</button>);
    const button = screen.getByRole("button", { name: "earlier focus" });
    button.focus();
    press("?", { shiftKey: true }, button);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("the footer button is for screens that have a keyboard, not phones", () => {
    setup(<ShortcutsButton />);
    expect(screen.getByRole("button", { name: /Keyboard shortcuts/ })).toHaveClass(
      "hidden",
      "md:inline-flex",
    );
  });

  it("opens from the footer button too", async () => {
    const user = userEvent.setup();
    setup(<ShortcutsButton />);
    await user.click(screen.getByRole("button", { name: /Keyboard shortcuts/ }));
    expect(
      screen.getByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeInTheDocument();
  });

  it("has a switch that turns the single-key shortcuts off and on, and remembers it", async () => {
    const user = userEvent.setup();
    setup();
    press("?", { shiftKey: true });
    const toggle = screen.getByRole("switch", { name: "Single-key shortcuts" });
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(useHotkeysStore.getState().enabled).toBe(false);
    expect(JSON.parse(localStorage.getItem(HOTKEYS_STORAGE_KEY)!).state.enabled).toBe(
      false,
    );

    await user.click(toggle);
    expect(useHotkeysStore.getState().enabled).toBe(true);
  });

  it("with the switch off, only Ctrl+K still works; ? stays off too", () => {
    useHotkeysStore.setState({ enabled: false });
    setup();
    press("t");
    press("g");
    press("m");
    press("?", { shiftKey: true });
    expect(root.classList.contains("dark")).toBe(false);
    expect(routerCalls).toEqual([]);
    expect(useHotkeysStore.getState().overlayOpen).toBe(false);
    press("k", { ctrlKey: true });
    expect(usePaletteStore.getState().open).toBe(true);
  });
});

describe("moving through a table", () => {
  const COINS = ["bitcoin", "ethereum", "solana"].map((id, i) =>
    makeCoin({
      id,
      name: id[0]!.toUpperCase() + id.slice(1),
      symbol: id.slice(0, 3),
      rank: i + 1,
    }),
  );

  beforeEach(() => {
    // jsdom has no layout: every row is on screen, 64px tall.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 164,
      width: 400,
      height: 64,
    } as DOMRect);
  });

  const table = () =>
    setup(<MarketsTable rows={COINS} sort="rank" dir="asc" onSort={() => {}} />);
  const rows = () => screen.getAllByRole("row").slice(1); // minus the header

  it("j and k move the selected row, down and up", () => {
    table();
    press("j");
    expect(rows()[0]).toHaveFocus();
    press("j");
    expect(rows()[1]).toHaveFocus();
    press("k");
    expect(rows()[0]).toHaveFocus();
  });

  it("rows can be selected but are not extra Tab stops", () => {
    table();
    for (const row of rows()) expect(row).toHaveAttribute("tabindex", "-1");
  });

  it("w puts the selected row's asset on the watchlist, and takes it off", () => {
    table();
    press("j");
    press("j");
    press("w");
    expect(useWatchlistStore.getState().ids).toEqual(["ethereum"]);
    press("w");
    expect(useWatchlistStore.getState().ids).toEqual([]);
  });

  it("w with no row selected does nothing", () => {
    table();
    press("w");
    expect(useWatchlistStore.getState().ids).toEqual([]);
  });

  it("Enter opens the selected row's asset page", () => {
    table();
    const followed = vi.fn((e: Event) => e.preventDefault());
    document.addEventListener("click", followed, true);
    press("j");
    press("Enter");
    expect(followed).toHaveBeenCalled();
    expect(
      (followed.mock.calls[0]![0].target as HTMLAnchorElement).getAttribute("href"),
    ).toBe("/coin/bitcoin");
    document.removeEventListener("click", followed, true);
  });

  it("Enter is left alone when focus is on a button inside the row", () => {
    table();
    const star = within(rows()[0]!).getByRole("button", { name: /Watch/ });
    star.focus();
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
    });
    act(() => void star.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
  });
});
