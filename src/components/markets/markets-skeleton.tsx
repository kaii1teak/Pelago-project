import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_SIZE } from "@/lib/markets-table";
import { ROW_HEIGHT } from "./coin-row";

/** Same row height and column visibility as the real table, so data arriving doesn't move anything. */
export function MarketsSkeleton({
  rows = PAGE_SIZE,
  label = "Loading markets",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <div className="h-[2.875rem] border-b border-strong" />
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`${ROW_HEIGHT} flex items-center gap-4 border-b border-primary px-4 last:border-b-0`}
        >
          <Skeleton className="size-5 shrink-0" />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-10" />
            </div>
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="hidden h-4 w-16 md:block" />
          <Skeleton className="hidden h-4 w-16 lg:block" />
          <Skeleton className="hidden h-8 w-32 lg:block" />
        </div>
      ))}
    </div>
  );
}
