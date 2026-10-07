import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MAX_WATCHLIST = 100;
export const WATCHLIST_STORAGE_KEY = "pelago-watchlist";

type WatchlistState = {
  /** Coin ids, in the order they were added. */
  ids: string[];
  add: (id: string) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  clear: () => void;
};

/**
 * Persisted to localStorage. `skipHydration` is deliberate: the server renders
 * an empty list, so reading localStorage during the first client render would
 * make the HTML mismatch and React would throw away the server markup.
 * <StoreHydrator /> rehydrates once, after mount, instead.
 */
export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      add: (id) =>
        set((s) =>
          s.ids.includes(id) || s.ids.length >= MAX_WATCHLIST
            ? s
            : { ids: [...s.ids, id] },
        ),
      remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
      toggle: (id) => (get().ids.includes(id) ? get().remove(id) : get().add(id)),
      clear: () => set({ ids: [] }),
    }),
    {
      name: WATCHLIST_STORAGE_KEY,
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ ids: s.ids }),
      // Stored data is user-editable text: never trust its shape.
      merge: (persisted, current) => {
        const ids = (persisted as { ids?: unknown } | null)?.ids;
        const clean = Array.isArray(ids)
          ? [
              ...new Set(
                ids.filter((x): x is string => typeof x === "string" && x.length > 0),
              ),
            ]
          : [];
        return { ...current, ids: clean.slice(0, MAX_WATCHLIST) };
      },
    },
  ),
);

/** Whether a coin is watched. Returns a boolean, so a row only re-renders when *its* state flips. */
export const useIsWatched = (id: string) => useWatchlistStore((s) => s.ids.includes(id));

/**
 * True once the persisted list has been read from localStorage. Until then `ids`
 * is the server's empty list, so a page that *shows* the list must wait for this
 * (or it flashes "nothing saved" for a frame). The server always reports false.
 */
export function useWatchlistHydrated() {
  return useSyncExternalStore(
    (onChange) => useWatchlistStore.persist.onFinishHydration(onChange),
    () => useWatchlistStore.persist.hasHydrated(),
    () => false,
  );
}
