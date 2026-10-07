import { cn } from "@/lib/utils";

/**
 * The Pelago mark: an archipelago, one large island and two smaller ones
 * drifting off it. Solid circles in the current text color, so it follows the
 * theme without any color of its own.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <circle cx="13" cy="18" r="10" />
      <circle cx="25.5" cy="9" r="4.5" />
      <circle cx="26" cy="24.5" r="2.5" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-primary", className)}>
      <LogoMark className="size-6" />
      <span className="text-heading-sm">pelago</span>
    </span>
  );
}
