"use client";

import { Check } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { COMPARE_PALETTE } from "@/lib/compare";
import { cn } from "@/lib/utils";

/** Keep this much air between the open grid and the edge of the screen. */
const EDGE = 8;

const cssColor = (index: number) =>
  `var(${COMPARE_PALETTE[index % COMPARE_PALETTE.length]!.token})`;

/** The colored bar that ties a chip (or a table column) to its line on the chart. */
export function Swatch({ color, className }: { color: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className ?? "h-6 w-1 shrink-0"}
      style={{ backgroundColor: cssColor(color) }}
    />
  );
}

/**
 * Changes a line's color. The swatch is a button that opens a small grid of the
 * ten colors (a radio group: arrow keys move, Enter or Space picks, Escape closes
 * and hands focus back). Colors another asset already uses are still offered:
 * choosing one swaps the two, so a pick always does what it says.
 */
export function ColorPicker({
  assetName,
  value,
  onChange,
  className,
}: {
  assetName: string;
  value: number;
  onChange: (color: number) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const base = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const current = COMPARE_PALETTE[value % COMPARE_PALETTE.length]!;

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  };

  // Open: focus the selected color. Click anywhere outside (or Escape) closes it.
  useEffect(() => {
    if (!open) return;
    options.current[value]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // Only on opening: later changes of `value` must not steal focus back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The grid hangs from the swatch's left edge; a chip near the right edge of a narrow
  // screen would push it off. Measure once it is on screen and, if so, hang it from the
  // right edge instead. (Set on the element: this is a measurement, not state.)
  useLayoutEffect(() => {
    const box = grid.current;
    if (!open || !box) return;
    if (box.getBoundingClientRect().right > document.documentElement.clientWidth - EDGE) {
      box.style.left = "auto";
      box.style.right = "0";
    }
  }, [open]);

  const move = (event: React.KeyboardEvent, from: number) => {
    const last = COMPARE_PALETTE.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = from === last ? 0 : from + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = from === 0 ? last : from - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation(); // don't also close a dialog this lives in
      close(true);
      return;
    }
    if (next !== null) {
      event.preventDefault();
      options.current[next]?.focus();
    }
  };

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        ref={trigger}
        type="button"
        aria-label={`Color of ${assetName}: ${current.name}. Change`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? `${base}-grid` : undefined}
        onClick={() => setOpen((o) => !o)}
        // A wider hit area than the 4px bar it draws.
        className="flex h-8 w-4 items-center justify-center rounded-control transition-colors duration-150 ease-standard hover:bg-overlay-hover"
      >
        <Swatch color={value} className="h-8 w-1 shrink-0" />
      </button>

      {open && (
        <div
          ref={grid}
          id={`${base}-grid`}
          role="radiogroup"
          aria-label={`Color for ${assetName}`}
          // w-max: an absolutely placed box is as wide as its room, and the room under a
          // 16px swatch is 16px, which would stack the ten colors on top of each other.
          className="absolute top-full left-0 z-30 mt-2 grid w-max grid-cols-5 gap-2 border border-strong bg-primary p-3 shadow-dropdown"
        >
          {COMPARE_PALETTE.map((color, i) => (
            <button
              key={color.token}
              ref={(el) => {
                options.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={i === value}
              aria-label={color.name}
              // Roving tabindex: one Tab stop for the whole grid.
              tabIndex={i === value ? 0 : -1}
              onKeyDown={(event) => move(event, i)}
              onClick={() => {
                onChange(i);
                close(true);
              }}
              style={{ backgroundColor: cssColor(i) }}
              className="flex size-7 items-center justify-center rounded-control text-primary"
            >
              {i === value && (
                <Check className="size-4 mix-blend-difference" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
