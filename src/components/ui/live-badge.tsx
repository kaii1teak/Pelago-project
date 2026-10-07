import { cn } from "@/lib/utils";

/**
 * "Live" indicator, as a mono label. The dot is decorative; the state is in the
 * text. `offline` is for when refreshing fails but we're still showing the last data.
 */
export function LiveBadge({
  status = "live",
  className,
}: {
  status?: "live" | "offline";
  className?: string;
}) {
  const live = status === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 label-mono",
        live ? "text-muted" : "text-critical",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-critical")}
      />
      {live ? "Live · refreshes every minute" : "Reconnecting, showing last data"}
    </span>
  );
}
