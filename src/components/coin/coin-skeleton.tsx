import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the loaded layout (header, chart box, stat rows) so nothing moves when data arrives. */
export function CoinSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading asset"
      className="space-y-20 md:space-y-28"
    >
      <div className="space-y-8">
        <Skeleton className="h-3 w-40" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-chart w-full rounded-none" />
      </div>
      <div className="border-t border-primary">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex h-14 items-center justify-between border-b border-primary px-2"
          >
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
