"use client";

import type { HotkeyId } from "@/lib/hotkeys/catalog";
import { useHotkeysStore } from "@/stores/hotkeys";
import { ShortcutKeys } from "./shortcut-keys";

/**
 * A tooltip's content: the label, and the shortcut for the same thing as keycaps on the
 * tooltip's dark background. The keycaps go away while shortcuts are switched off.
 */
export function HotkeyTip({ label, id }: { label: string; id: HotkeyId }) {
  const enabled = useHotkeysStore((s) => s.enabled);
  return (
    <span className="flex items-center gap-2">
      {label}
      {enabled && (
        <span aria-hidden="true">
          <ShortcutKeys id={id} keyClassName="border-current/40 text-inverse" />
        </span>
      )}
    </span>
  );
}
