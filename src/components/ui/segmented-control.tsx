"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { DURATION, EASE_STANDARD } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * A single-choice control for switching a *filter or view*: a group of toggle
 * buttons with a sliding selected block. (Real Tabs promise a separate panel per
 * tab, which this isn't.)
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  /** Accessible name for the group, e.g. "Show". */
  label: string;
  className?: string;
}) {
  const blockId = useId();

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "relative inline-flex items-center rounded-control border border-primary bg-subtle p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative inline-flex h-8 items-center justify-center rounded-control px-3 text-body-md font-medium whitespace-nowrap transition-colors duration-fast ease-standard",
              active ? "text-inverse" : "text-secondary hover:text-primary",
            )}
          >
            {active && (
              <motion.span
                layoutId={`${blockId}-block`}
                aria-hidden="true"
                className="absolute inset-0 rounded-control bg-inverse"
                transition={{ duration: DURATION.base, ease: EASE_STANDARD }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
