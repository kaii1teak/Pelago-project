"use client";

import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * The curated categories as a row of toggle chips, "All assets" first. One row you swipe on
 * a phone (it bleeds to the screen edge, which is the page gutter), wrapped from `sm` up.
 */
export function CategoryChips({
  category,
  onCategoryChange,
}: {
  category: string | null;
  onCategoryChange: (category: string | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Category"
      className="-mx-[var(--gutter)] flex [scrollbar-width:none] gap-2 overflow-x-auto px-[var(--gutter)] pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {[{ id: null, label: "All assets" }, ...CATEGORIES].map((c) => {
        const active = c.id === category;
        return (
          <button
            key={c.id ?? "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onCategoryChange(c.id)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-control border px-3 text-body-md whitespace-nowrap transition-colors duration-fast ease-standard",
              active
                ? "border-transparent bg-inverse text-inverse"
                : "border-primary text-secondary hover:bg-overlay-hover hover:text-primary active:bg-overlay-pressed",
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
