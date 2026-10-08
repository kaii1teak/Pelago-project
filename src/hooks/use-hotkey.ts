"use client";

import { useEffect, useRef } from "react";
import type { HotkeyId } from "@/lib/hotkeys/catalog";
import { HotkeyDispatcher, type HotkeyHandler } from "@/lib/hotkeys/dispatcher";
import { useHotkeysStore } from "@/stores/hotkeys";

/**
 * The one dispatcher of the app. <HotkeysProvider> listens for keys and feeds it; any
 * component can register what a shortcut does while it is on screen.
 */
export const dispatcher = new HotkeyDispatcher({
  isEnabled: () => useHotkeysStore.getState().enabled,
  onPending: (pending) => useHotkeysStore.getState().setPending(pending),
});

/**
 * Makes a catalog shortcut (lib/hotkeys/catalog.ts) do something while this component is
 * mounted. The key itself, its description and where it works are the catalog's business.
 * Return false from the handler when the shortcut didn't apply after all: the key then
 * keeps its normal meaning.
 */
export function useHotkey(id: HotkeyId, handler: HotkeyHandler, enabled = true) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    return dispatcher.register(id, (event) => latest.current(event));
  }, [id, enabled]);
}
