import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stands in for the comparison until the saved selection has been read. Boxes
 * match the real ones (input, chips, chart) so nothing moves when it arrives.
 */
export function CompareSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the comparison"
      className="space-y-10"
    >
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-14 w-56" />
          <Skeleton className="h-14 w-56" />
        </div>
      </div>
      <Skeleton className="h-chart w-full rounded-none" />
    </div>
  );
}
