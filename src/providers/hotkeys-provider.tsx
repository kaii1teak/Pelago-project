"use client";

import { useEffect } from "react";
import { GlobalHotkeys } from "@/components/shortcuts/global-hotkeys";
import { PendingHint } from "@/components/shortcuts/pending-hint";
import { ShortcutsOverlayLoader } from "@/components/shortcuts/shortcuts-overlay-loader";
import { dispatcher } from "@/hooks/use-hotkey";

/**
 * Listens for keys, once, for the whole app, and mounts what belongs to the shortcut
 * system: the handlers that work everywhere, the overlay that lists them, and the hint
 * shown between the two keys of a sequence.
 */
export function HotkeysProvider() {
  useEffect(() => {
    const forget = () => dispatcher.reset();
    window.addEventListener("keydown", dispatcher.handleKeyDown);
    // A click or leaving the window ends a half-typed sequence.
    window.addEventListener("pointerdown", forget);
    window.addEventListener("blur", forget);
    return () => {
      window.removeEventListener("keydown", dispatcher.handleKeyDown);
      window.removeEventListener("pointerdown", forget);
      window.removeEventListener("blur", forget);
      dispatcher.reset();
    };
  }, []);

  return (
    <>
      <GlobalHotkeys />
      <ShortcutsOverlayLoader />
      <PendingHint />
    </>
  );
}
