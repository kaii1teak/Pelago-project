"use client";

import { GitCompareArrows } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { HotkeyTip } from "@/components/shortcuts/hotkey-tip";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useHotkey } from "@/hooks/use-hotkey";
import { useCompareStore } from "@/stores/compare";

/**
 * Starts a comparison from an asset page: adds the coin to the saved selection
 * (ignored if it's already there or the comparison is full) and opens /compare,
 * which shows it next to whatever was already being compared.
 */
export function CompareLink({ id, name }: { id: string; name: string }) {
  const add = useCompareStore((s) => s.add);
  const link = useRef<HTMLAnchorElement>(null);
  // "a" does what pressing the button does, by pressing it.
  useHotkey("asset.compare", () => link.current?.click());
  return (
    <Tooltip content={<HotkeyTip label="Compare with other assets" id="asset.compare" />}>
      <Link
        ref={link}
        href="/compare"
        onClick={() => add(id)}
        aria-label={`Compare ${name} with other assets`}
        aria-keyshortcuts="A"
        className={buttonVariants({ variant: "outline", size: "md" })}
      >
        <GitCompareArrows aria-hidden="true" />
        Compare
      </Link>
    </Tooltip>
  );
}
