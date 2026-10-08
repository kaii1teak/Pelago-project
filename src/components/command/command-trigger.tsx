"use client";

import { Search } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { usePaletteStore } from "@/stores/palette";
import { Kbd } from "./kbd";

const noop = () => () => {};

/** "⌘" on Apple devices, "Ctrl" elsewhere. The server always says "Ctrl": no hydration mismatch. */
function useModifierKey() {
  return useSyncExternalStore(
    noop,
    () => (/Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

/**
 * Opens the palette from the header. A search field with its shortcut on wide
 * screens, a plain icon button on phones (where there is no keyboard shortcut).
 */
export function CommandTrigger() {
  const setOpen = usePaletteStore((s) => s.setOpen);
  const modifier = useModifierKey();
  const open = () => setOpen(true);

  return (
    <>
      {/* No aria-label: the name is its visible text ("Search ⌘ K"), as WCAG 2.5.3 asks. */}
      <Button
        variant="outline"
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={open}
        className="hidden w-56 justify-between font-normal text-muted md:inline-flex"
      >
        <span className="flex items-center gap-2">
          <Search aria-hidden="true" />
          Search
        </span>{" "}
        {/* The space keeps the name "Search Ctrl K" in every engine (flex ignores it visually). */}
        <Kbd className="border-0 px-0">{modifier} K</Kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Search assets and pages"
        aria-haspopup="dialog"
        onClick={open}
        className="md:hidden [&_svg]:size-5"
      >
        <Search aria-hidden="true" />
      </Button>
    </>
  );
}
