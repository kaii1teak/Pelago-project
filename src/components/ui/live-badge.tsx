import type { LiveStatus } from "@/lib/live/types";
import { cn } from "@/lib/utils";

/** What the badge says for each state of the live feed (when the data itself is fine). */
const STREAM: Record<LiveStatus, { text: string; dot: string }> = {
  idle: { text: "Live · refreshes every minute", dot: "bg-success" },
  live: { text: "Live · prices streaming", dot: "bg-success" },
  connecting: { text: "Live · connecting", dot: "bg-warning" },
  reconnecting: { text: "Live · reconnecting", dot: "bg-warning" },
  paused: { text: "Paused · tab in the background", dot: "bg-muted" },
  polling: { text: "Polling · refreshes every minute", dot: "bg-warning" },
};

/**
 * "Live" indicator, as a mono label. The dot is decorative; the state is in the text.
 * `status="offline"` is for when refreshing fails but we're still showing the last data.
 * `stream` is the live feed's own state: without it (or while it is idle) the badge says
 * what it always said, that the numbers refresh every minute.
 */
export function LiveBadge({
  status = "live",
  stream = "idle",
  className,
}: {
  status?: "live" | "offline";
  stream?: LiveStatus;
  className?: string;
}) {
  const offline = status === "offline";
  const { text, dot } = STREAM[stream];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 label-mono",
        offline ? "text-critical" : "text-muted",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", offline ? "bg-critical" : dot)}
      />
      {offline ? "Reconnecting, showing last data" : text}
    </span>
  );
}
