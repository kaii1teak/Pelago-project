"use client";

import { useSyncExternalStore } from "react";
import { isMac } from "@/lib/hotkeys/keys";

const noop = () => () => {};

/** An Apple device, where the modifier is Cmd (⌘) rather than Ctrl. The server says no: no hydration mismatch. */
export function useIsMac() {
  return useSyncExternalStore(
    noop,
    () => isMac(navigator.platform),
    () => false,
  );
}
