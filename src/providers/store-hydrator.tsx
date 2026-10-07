"use client";

import { useEffect } from "react";
import { useWatchlistStore } from "@/stores/watchlist";

/** Rehydrates persisted stores after mount (see `skipHydration` in each store). */
export function StoreHydrator() {
  useEffect(() => {
    void useWatchlistStore.persist.rehydrate();
  }, []);
  return null;
}
