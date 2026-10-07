import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithClient } from "@/test/render";
import { WATCHLIST_STORAGE_KEY, useWatchlistStore } from "@/stores/watchlist";
import { WatchButton } from "./watch-button";

beforeEach(() => {
  localStorage.clear();
  useWatchlistStore.setState({ ids: [] });
});

describe("WatchButton", () => {
  it("has a constant name and exposes the state through aria-pressed", async () => {
    renderWithClient(<WatchButton id="bitcoin" name="Bitcoin" />);
    const button = screen.getByRole("button", { name: "Watch Bitcoin" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);
    // Same accessible name; only the pressed state changed.
    expect(screen.getByRole("button", { name: "Watch Bitcoin" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("adds to and removes from the persisted watchlist", async () => {
    renderWithClient(<WatchButton id="bitcoin" name="Bitcoin" />);
    await userEvent.click(screen.getByRole("button", { name: "Watch Bitcoin" }));
    expect(useWatchlistStore.getState().ids).toEqual(["bitcoin"]);
    expect(JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY)!).state.ids).toEqual([
      "bitcoin",
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Watch Bitcoin" }));
    expect(useWatchlistStore.getState().ids).toEqual([]);
  });

  it("reflects a coin already on the list (e.g. after rehydrating from storage)", async () => {
    renderWithClient(<WatchButton id="solana" name="Solana" />);
    expect(screen.getByRole("button", { name: "Watch Solana" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await act(async () => {
      localStorage.setItem(
        WATCHLIST_STORAGE_KEY,
        JSON.stringify({ state: { ids: ["solana"] }, version: 1 }),
      );
      await useWatchlistStore.persist.rehydrate();
    });
    expect(screen.getByRole("button", { name: "Watch Solana" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("only the button for the toggled coin changes", async () => {
    renderWithClient(
      <>
        <WatchButton id="a" name="Alpha" />
        <WatchButton id="b" name="Bravo" />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Watch Alpha" }));
    expect(screen.getByRole("button", { name: "Watch Alpha" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Watch Bravo" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("works from the keyboard", async () => {
    renderWithClient(<WatchButton id="bitcoin" name="Bitcoin" />);
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(useWatchlistStore.getState().ids).toEqual(["bitcoin"]);
  });
});
