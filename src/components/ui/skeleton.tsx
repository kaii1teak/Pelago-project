import { cn } from "@/lib/utils";

/**
 * Loading placeholder: a flat block that pulses (opacity only, no gradient).
 * Always size it explicitly (h-/w-/aspect-) to match the content it stands in
 * for, so nothing shifts when the data arrives. Decorative: announce loading
 * state on the container (aria-busy / role="status").
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-skeleton rounded-control bg-secondary", className)}
      {...props}
    />
  );
}
