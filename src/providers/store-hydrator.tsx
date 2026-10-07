"use client";

import { useEffect } from "react";
import { WATCHLIST_STORAGE_KEY, useWatchlistStore } from "@/stores/watchlist";

/**
 * Rehydrates persisted stores after mount (see `skipHydration` in each store),
 * and again whenever another tab changes the saved list, so two open tabs never
 * disagree about what is watched.
 */
export function StoreHydrator() {
  useEffect(() => {
    void useWatchlistStore.persist.rehydrate();

    const onStorage = (event: StorageEvent) => {
      // `key === null` means the whole storage was cleared.
      if (event.key === WATCHLIST_STORAGE_KEY || event.key === null) {
        void useWatchlistStore.persist.rehydrate();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
