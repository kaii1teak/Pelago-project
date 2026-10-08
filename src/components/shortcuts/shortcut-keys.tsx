"use client";

import { Fragment } from "react";
import { Kbd } from "@/components/command/kbd";
import { hotkeyDef, type HotkeyId } from "@/lib/hotkeys/catalog";
import { chordLabels, parseKeys } from "@/lib/hotkeys/keys";
import { useIsMac } from "@/hooks/use-is-mac";
import { cn } from "@/lib/utils";

/**
 * The keycaps for a catalog shortcut: "⌘ K" or "Ctrl K" for the platform, "G" then "H" for
 * a sequence. Reads as words for a screen reader ("G then H"); put it inside something
 * `aria-hidden` where it only repeats what the label says.
 */
export function ShortcutKeys({
  id,
  className,
  keyClassName,
}: {
  id: HotkeyId;
  className?: string;
  /** Extra classes for each keycap (a different color on a dark tooltip). */
  keyClassName?: string;
}) {
  const mac = useIsMac();
  const chords = parseKeys(hotkeyDef(id).keys);

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {chords.map((chord, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="sr-only"> then </span>}
          <span className="inline-flex items-center gap-1">
            {chordLabels(chord, mac).map((label) => (
              <Kbd key={label} className={keyClassName}>
                {label}
              </Kbd>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
