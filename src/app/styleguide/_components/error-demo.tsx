"use client";

import { useState } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { ApiError } from "@/lib/api/errors";

const SAMPLE = new ApiError("rate_limited", undefined, { retryAfter: 30 });

/** Retry is interactive, so the demo has to be a Client Component (functions can't cross from the server). */
export function ErrorDemo() {
  const [retrying, setRetrying] = useState(false);

  return (
    <ErrorState
      error={SAMPLE}
      retrying={retrying}
      onRetry={() => {
        setRetrying(true);
        setTimeout(() => setRetrying(false), 1500);
      }}
    />
  );
}
