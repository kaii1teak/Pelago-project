"use client";

import { HOTKEYS } from "@/lib/hotkeys/catalog";
import { parseKeys } from "@/lib/hotkeys/keys";
import { useHotkeysStore } from "@/stores/hotkeys";
import { Kbd } from "@/components/command/kbd";

/**
 * After a first key of a sequence ("g"), shows what can come next, so the sequences
 * can be found without reading the overlay. Gone after a second, or on the next key.
 */
export function PendingHint() {
  const pending = useHotkeysStore((s) => s.pending);
  if (!pending) return null;

  const next = HOTKEYS.flatMap((hotkey) => {
    const chords = parseKeys(hotkey.keys);
    const matches =
      chords.length > pending.length && pending.every((key, i) => chords[i]!.key === key);
    return matches
      ? [{ key: chords[pending.length]!.key.toUpperCase(), label: hotkey.description }]
      : [];
  });

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-4 left-4 z-40 animate-fade-in border border-strong bg-primary px-4 py-3 shadow-dropdown"
    >
      <p className="mb-2 label-mono text-muted">
        <Kbd className="mr-1">{pending.join(" ").toUpperCase()}</Kbd> then…
      </p>
      <ul className="space-y-1">
        {next.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-3 text-body-sm text-secondary"
          >
            <Kbd>{item.key}</Kbd>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
