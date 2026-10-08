"use client";

import { Keyboard } from "lucide-react";
import { useHotkeysStore } from "@/stores/hotkeys";
import { ShortcutKeys } from "./shortcut-keys";

/** Opens the shortcuts overlay for people who haven't met "?" (and for turning shortcuts back on). */
export function ShortcutsButton() {
  const open = useHotkeysStore((s) => s.openOverlay);
  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      className="hidden items-center gap-2 rounded-control text-mono-sm text-muted transition-colors duration-fast ease-standard hover:text-primary md:inline-flex"
    >
      <Keyboard className="size-4" aria-hidden="true" />
      Keyboard shortcuts
      <span aria-hidden="true">
        <ShortcutKeys id="shortcuts" />
      </span>
    </button>
  );
}
