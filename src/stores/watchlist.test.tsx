import { beforeEach, describe, expect, it } from "vitest";
import { MAX_WATCHLIST, WATCHLIST_STORAGE_KEY, useWatchlistStore } from "./watchlist";

const store = useWatchlistStore;

beforeEach(() => {
  localStorage.clear();
  store.setState({ ids: [] });
});

describe("watchlist store", () => {
  it("adds, removes and toggles", () => {
    store.getState().add("bitcoin");
    store.getState().add("ethereum");
    expect(store.getState().ids).toEqual(["bitcoin", "ethereum"]);

    store.getState().remove("bitcoin");
    expect(store.getState().ids).toEqual(["ethereum"]);

    store.getState().toggle("ethereum");
    store.getState().toggle("solana");
    expect(store.getState().ids).toEqual(["solana"]);
  });

  it("ignores duplicates and keeps insertion order", () => {
    store.getState().add("a");
    store.getState().add("b");
    store.getState().add("a");
    expect(store.getState().ids).toEqual(["a", "b"]);
  });

  it("caps the list", () => {
    for (let i = 0; i < MAX_WATCHLIST + 10; i++) store.getState().add(`coin-${i}`);
    expect(store.getState().ids).toHaveLength(MAX_WATCHLIST);
  });

  it("persists to localStorage under a stable key", () => {
    store.getState().add("bitcoin");
    const saved = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY)!);
    expect(saved.state.ids).toEqual(["bitcoin"]);
    expect(saved.version).toBe(1);
  });

  it("does not read storage until rehydrated (so SSR markup matches the first client render)", () => {
    localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify({ state: { ids: ["bitcoin"] }, version: 1 }),
    );
    expect(store.getState().ids).toEqual([]);
  });

  it("rehydrates saved ids on demand", async () => {
    localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify({ state: { ids: ["bitcoin", "solana"] }, version: 1 }),
    );
    await store.persist.rehydrate();
    expect(store.getState().ids).toEqual(["bitcoin", "solana"]);
  });

  it.each([
    ["junk types and duplicates", { ids: ["a", 7, null, "", "a", "b"] }, ["a", "b"]],
    ["a non-array", { ids: "bitcoin" }, []],
    ["a missing field", {}, []],
  ])("sanitizes corrupted saved data: %s", async (_label, saved, expected) => {
    localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify({ state: saved, version: 1 }),
    );
    await store.persist.rehydrate();
    expect(store.getState().ids).toEqual(expected);
  });

  it("survives unparseable storage without crashing", async () => {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, "{not json");
    await expect(store.persist.rehydrate()).resolves.not.toThrow();
    expect(Array.isArray(store.getState().ids)).toBe(true);
  });
});

describe("useWatchlistHydrated", () => {
  it("reports false on the server and true once the saved list has been read", async () => {
    const { renderToString } = await import("react-dom/server");
    const { useWatchlistHydrated } = await import("./watchlist");
    const Probe = () => <span>{String(useWatchlistHydrated())}</span>;
    // The server snapshot is always false, whatever the client store says.
    expect(renderToString(<Probe />)).toContain("false");
  });
});
