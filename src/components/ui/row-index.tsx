import { cn } from "@/lib/utils";

/** "[01]": the mono index shown at the edge of a row. `n` is 1-based. */
export function RowIndex({ n, className }: { n: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("num text-mono-sm text-muted", className)}>
      [{String(n).padStart(2, "0")}]
    </span>
  );
}
