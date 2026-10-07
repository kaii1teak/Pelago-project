"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

// Next 16's error boundaries receive `retry` (re-fetch + re-render the segment),
// not the older `reset`.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="page-container flex min-h-hero items-center justify-center">
      <ErrorState
        title="Something broke on our side"
        error={error}
        onRetry={retry}
        className="w-full"
      />
    </section>
  );
}
