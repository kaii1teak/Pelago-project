import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { COIN_ID_PATTERN } from "@/lib/chart";
import { MAX_COMPARE, assignColors, withColor } from "@/lib/compare";

export const COMPARE_STORAGE_KEY = "pelago-compare";

type CompareState = {
  /** Coin ids being compared, in the order they were picked. */
  ids: string[];
  /** The line color of each (an index into COMPARE_PALETTE). Always one per id, never shared. */
  colors: Record<string, number>;
  add: (id: string) => void;
  remove: (id: string) => void;
  /** Replace the whole list (opening a shared link). Colors of assets that stay are kept. */
  set: (ids: readonly string[]) => void;
  /** Give `id` this color; whoever had it gets the color `id` had. */
  setColor: (id: string, color: number) => void;
  clear: () => void;
};

/** Anything stored is user-editable text: keep only valid, unique ids, capped. */
const cleanIds = (ids: unknown): string[] =>
  Array.isArray(ids)
    ? [
        ...new Set(
          ids.filter(
            (x): x is string => typeof x === "string" && COIN_ID_PATTERN.test(x),
          ),
        ),
      ].slice(0, MAX_COMPARE)
    : [];

const cleanColors = (colors: unknown): Record<string, number> =>
  typeof colors === "object" && colors !== null ? (colors as Record<string, number>) : {};

/**
 * Persisted to localStorage, hydrated after mount for the same reason as the
 * watchlist (see its `skipHydration` note): the server renders the empty list.
 */
export const useCompareStore = create<CompareState>()(
  persist(
    (set) => ({
      ids: [],
      colors: {},
      add: (id) =>
        set((s) => {
          if (s.ids.includes(id) || s.ids.length >= MAX_COMPARE) return s;
          const ids = [...s.ids, id];
          return { ids, colors: assignColors(ids, s.colors) };
        }),
      remove: (id) =>
        set((s) => {
          const ids = s.ids.filter((x) => x !== id);
          // The others keep their colors; the removed one's color becomes free again.
          return { ids, colors: assignColors(ids, s.colors) };
        }),
      set: (next) =>
        set((s) => {
          const ids = cleanIds(next);
          return { ids, colors: assignColors(ids, s.colors) };
        }),
      setColor: (id, color) => set((s) => ({ colors: withColor(s.colors, id, color) })),
      clear: () => set({ ids: [], colors: {} }),
    }),
    {
      name: COMPARE_STORAGE_KEY,
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ ids: s.ids, colors: s.colors }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as { ids?: unknown; colors?: unknown };
        const ids = cleanIds(saved.ids);
        // Older saves have no colors; bad ones are repaired, not trusted.
        return { ...current, ids, colors: assignColors(ids, cleanColors(saved.colors)) };
      },
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
