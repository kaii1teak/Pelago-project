import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { COMPARE_STORAGE_KEY, useCompareStore } from "@/stores/compare";
import { WATCHLIST_STORAGE_KEY, useWatchlistStore } from "@/stores/watchlist";
import { StoreHydrator } from "./store-hydrator";

const save = (ids: string[]) =>
  localStorage.setItem(
    WATCHLIST_STORAGE_KEY,
    JSON.stringify({ state: { ids }, version: 1 }),
  );

beforeEach(() => {
  localStorage.clear();
  useWatchlistStore.setState({ ids: [] });
});

describe("StoreHydrator", () => {
  it("reads the saved list once mounted", async () => {
    save(["bitcoin"]);
    render(<StoreHydrator />);
    await act(async () => {});
    expect(useWatchlistStore.getState().ids).toEqual(["bitcoin"]);
  });

  it("follows another tab: a change to the saved list rehydrates the store", async () => {
    render(<StoreHydrator />);
    await act(async () => {});

    save(["bitcoin", "solana"]);
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: WATCHLIST_STORAGE_KEY }));
    });
    expect(useWatchlistStore.getState().ids).toEqual(["bitcoin", "solana"]);
  });

  it("follows a storage wipe, too", async () => {
    save(["bitcoin"]);
    render(<StoreHydrator />);
    await act(async () => {});
    expect(useWatchlistStore.getState().ids).toEqual(["bitcoin"]);

    localStorage.clear();
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(useWatchlistStore.getState().ids).toEqual([]);
  });

  it("ignores unrelated keys", async () => {
    render(<StoreHydrator />);
    await act(async () => {});
    useWatchlistStore.setState({ ids: ["kept"] });

    save(["other"]);
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "some-other-key" }));
    });
    expect(useWatchlistStore.getState().ids).toEqual(["kept"]);
  });

  it("stops listening when unmounted", async () => {
    const { unmount } = render(<StoreHydrator />);
    await act(async () => {});
    unmount();

    save(["bitcoin"]);
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: WATCHLIST_STORAGE_KEY }));
    });
    expect(useWatchlistStore.getState().ids).toEqual([]);
  });
});

describe("StoreHydrator: the comparison", () => {
  const saveCompare = (ids: string[]) =>
    localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify({ state: { ids }, version: 1 }),
    );

  beforeEach(() => useCompareStore.setState({ ids: [] }));

  it("reads the saved selection once mounted", async () => {
    saveCompare(["bitcoin", "ethereum"]);
    render(<StoreHydrator />);
    await act(async () => {});
    expect(useCompareStore.getState().ids).toEqual(["bitcoin", "ethereum"]);
  });

  it("follows another tab changing the selection", async () => {
    render(<StoreHydrator />);
    await act(async () => {});
    saveCompare(["solana"]);
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: COMPARE_STORAGE_KEY }));
    });
    expect(useCompareStore.getState().ids).toEqual(["solana"]);
  });
});
