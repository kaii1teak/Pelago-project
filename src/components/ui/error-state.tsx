import { RotateCw, TriangleAlert } from "lucide-react";
import { isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Button } from "./button";

function describe(error: unknown) {
  if (isApiError(error)) {
    if (error.code === "rate_limited" && error.retryAfter) {
      return `${error.message} (about ${error.retryAfter}s)`;
    }
    return error.message;
  }
  return "Something went wrong while loading this. It's usually temporary.";
}

/**
 * Inline failure state with a retry. Announced to screen readers (role="alert")
 * because it replaces content the user was waiting for.
 */
export function ErrorState({
  title = "Couldn't load this",
  error,
  onRetry,
  retrying = false,
  className,
}: {
  title?: string;
  error?: unknown;
  /** Omit to hide the retry button (e.g. for not_found errors). */
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-control bg-critical-tint text-critical">
        <TriangleAlert className="size-4" aria-hidden="true" />
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className="text-heading-xs text-primary">{title}</h3>
        <p className="text-body-md text-secondary">{describe(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} loading={retrying}>
          {!retrying && <RotateCw aria-hidden="true" />}
          Try again
        </Button>
      )}
    </div>
  );
}
