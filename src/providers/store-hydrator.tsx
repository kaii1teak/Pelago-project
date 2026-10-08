"use client";

import { useEffect } from "react";
import { COMPARE_STORAGE_KEY, useCompareStore } from "@/stores/compare";
import { HOTKEYS_STORAGE_KEY, useHotkeysStore } from "@/stores/hotkeys";
import { WATCHLIST_STORAGE_KEY, useWatchlistStore } from "@/stores/watchlist";

/**
 * Rehydrates persisted stores after mount (see `skipHydration` in each store),
 * and again whenever another tab changes a saved list, so two open tabs never
 * disagree about what is watched or compared.
 */
export function StoreHydrator() {
  useEffect(() => {
    void useWatchlistStore.persist.rehydrate();
    void useCompareStore.persist.rehydrate();
    void useHotkeysStore.persist.rehydrate();

    const onStorage = (event: StorageEvent) => {
      // `key === null` means the whole storage was cleared.
      if (event.key === WATCHLIST_STORAGE_KEY || event.key === null) {
        void useWatchlistStore.persist.rehydrate();
      }
      if (event.key === COMPARE_STORAGE_KEY || event.key === null) {
        void useCompareStore.persist.rehydrate();
      }
      if (event.key === HOTKEYS_STORAGE_KEY || event.key === null) {
        void useHotkeysStore.persist.rehydrate();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
