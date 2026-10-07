import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge resolves conflicts between Tailwind classes (the last one
 * wins), but it only knows Tailwind's own names. Without help it reads
 * `text-heading-md` as a *color* (anything unknown after `text-` looks like
 * one), so `cn("text-heading-md", "text-primary")` silently dropped the size.
 * These lists teach it the design system's classes. A test reads globals.css
 * and fails if a token is added there but not registered here.
 */
export const FONT_SIZES = [
  "heading-3xl",
  "heading-2xl",
  "heading-xl",
  "heading-lg",
  "heading-md",
  "heading-sm",
  "heading-xs",
  "body-xl",
  "body-lg",
  "body-md",
  "body-sm",
  "body-xs",
  "mono-md",
  "mono-sm",
] as const;

/** Every color name usable after bg-, text- or border- (theme colors + semantic utilities). */
export const COLOR_NAMES = [
  // semantic utilities (@utility bg-/text-/border- in globals.css)
  "primary",
  "subtle",
  "secondary",
  "tertiary",
  "inverse",
  "muted",
  "disabled",
  "strong",
  "subdued",
  "control",
  // theme colors (@theme inline --color-*)
  "accent",
  "accent-hover",
  "accent-pressed",
  "info",
  "success",
  "critical",
  "warning",
  "accent-tint",
  "success-tint",
  "critical-tint",
  "warning-tint",
  "overlay-card",
  "overlay-hover",
  "overlay-pressed",
  "overlay-subtle",
  "scrim",
  "btn-primary",
  "btn-primary-hover",
  "btn-primary-text",
  "btn-secondary",
  "btn-secondary-hover",
  "btn-secondary-pressed",
  "outline",
  "outline-hover",
  "outline-pressed",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
  "chart-9",
  "chart-10",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...FONT_SIZES] }],
      "text-color": [{ text: [...COLOR_NAMES] }],
      "bg-color": [{ bg: [...COLOR_NAMES] }],
      "border-color": [{ border: [...COLOR_NAMES] }],
    },
  },
});

/** Merge conditional class names, resolving Tailwind conflicts (last one wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
