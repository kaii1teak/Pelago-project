import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { COIN_ID_PATTERN } from "@/lib/chart";
import { MAX_COMPARE } from "@/lib/compare";

export const COMPARE_STORAGE_KEY = "pelago-compare";

type CompareState = {
  /** Coin ids being compared, in the order they were picked (that order sets their colors). */
  ids: string[];
  add: (id: string) => void;
  remove: (id: string) => void;
  /** Replace the whole list (opening a shared link). */
  set: (ids: readonly string[]) => void;
  clear: () => void;
};

/** Anything stored is user-editable text: keep only valid, unique ids, capped. */
const clean = (ids: unknown): string[] =>
  Array.isArray(ids)
    ? [
        ...new Set(
          ids.filter(
            (x): x is string => typeof x === "string" && COIN_ID_PATTERN.test(x),
          ),
        ),
      ].slice(0, MAX_COMPARE)
    : [];

/**
 * Persisted to localStorage, hydrated after mount for the same reason as the
 * watchlist (see its `skipHydration` note): the server renders the empty list.
 */
export const useCompareStore = create<CompareState>()(
  persist(
    (set) => ({
      ids: [],
      add: (id) =>
        set((s) =>
          s.ids.includes(id) || s.ids.length >= MAX_COMPARE ? s : { ids: [...s.ids, id] },
        ),
      remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
      set: (ids) => set({ ids: clean(ids) }),
      clear: () => set({ ids: [] }),
    }),
    {
      name: COMPARE_STORAGE_KEY,
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ ids: s.ids }),
      merge: (persisted, current) => ({
        ...current,
        ids: clean((persisted as { ids?: unknown } | null)?.ids),
      }),
    },
  ),
);

/** True once the saved selection has been read from localStorage (false on the server). */
export function useCompareHydrated() {
  return useSyncExternalStore(
    (onChange) => useCompareStore.persist.onFinishHydration(onChange),
    () => useCompareStore.persist.hasHydrated(),
    () => false,
  );
}
