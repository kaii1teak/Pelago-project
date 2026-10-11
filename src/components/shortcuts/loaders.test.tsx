import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPaletteLoader } from "@/components/command/command-palette-loader";
import { usePaletteStore } from "@/stores/palette";
import { useHotkeysStore } from "@/stores/hotkeys";
import { renderWithClient } from "@/test/render";
import { PRELOAD_DELAY_MS } from "@/hooks/use-load-on-demand";
import { ShortcutsOverlayLoader } from "./shortcuts-overlay-loader";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);

/**
 * The palette and the shortcuts overlay are used on request, so their code is not part of
 * the JavaScript every page downloads first: it is fetched when the page is idle, or at once
 * when one is asked for before that. These pin down both, and that asking works.
 */
beforeEach(() => {
  usePaletteStore.setState({ open: false, opener: null });
  useHotkeysStore.setState({
    overlayOpen: false,
    opener: null,
    pending: null,
    enabled: true,
  });
});
afterEach(() => vi.restoreAllMocks());

describe("the palette's loader", () => {
  it("draws nothing until the palette is asked for", () => {
    renderWithClient(<CommandPaletteLoader />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the palette once it is asked for, as soon as its code has arrived", async () => {
    renderWithClient(<CommandPaletteLoader />);
    act(() => usePaletteStore.getState().setOpen(true));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("stays loaded after it is closed, so closing can still animate out", async () => {
    renderWithClient(<CommandPaletteLoader />);
    act(() => usePaletteStore.getState().setOpen(true));
    await screen.findByRole("dialog");
    act(() => usePaletteStore.getState().setOpen(false));
    // Closed, not unmounted: opening it again is immediate.
    act(() => usePaletteStore.getState().setOpen(true));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

describe("the overlay's loader", () => {
  it("draws nothing until the overlay is asked for", () => {
    renderWithClient(<ShortcutsOverlayLoader />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the overlay once it is asked for", async () => {
    renderWithClient(<ShortcutsOverlayLoader />);
    act(() => useHotkeysStore.getState().openOverlay());
    expect(
      await screen.findByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeInTheDocument();
  });
});

describe("fetching the code ahead of time", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("waits a couple of seconds, then asks the browser for an idle moment: never in the page's first moments", () => {
    vi.useFakeTimers();
    const idle = vi.fn<(callback: IdleRequestCallback) => number>().mockReturnValue(7);
    const cancel = vi.fn();
    vi.stubGlobal("requestIdleCallback", idle);
    vi.stubGlobal("cancelIdleCallback", cancel);
    const { unmount } = renderWithClient(<CommandPaletteLoader />);

    act(() => void vi.advanceTimersByTime(PRELOAD_DELAY_MS - 1));
    expect(idle).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(idle).toHaveBeenCalledTimes(1);
    // It only asks the bundler to download the code; nothing is shown by it.
    expect(screen.queryByRole("dialog")).toBeNull();

    unmount();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it("does not fetch at all when the page is left before the wait is over", () => {
    vi.useFakeTimers();
    const idle = vi.fn<(callback: IdleRequestCallback) => number>().mockReturnValue(1);
    vi.stubGlobal("requestIdleCallback", idle);
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    renderWithClient(<ShortcutsOverlayLoader />).unmount();
    act(() => void vi.advanceTimersByTime(PRELOAD_DELAY_MS * 2));
    expect(idle).not.toHaveBeenCalled();
  });

  it("fetches straight away after the wait where there is no idle callback (Safari)", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    renderWithClient(<ShortcutsOverlayLoader />);
    // Nothing throws, and the wait is the same.
    act(() => void vi.advanceTimersByTime(PRELOAD_DELAY_MS));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
