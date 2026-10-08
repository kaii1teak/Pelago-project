"use client";

import "./globals.css";
import { SectionLabel } from "@/components/ui/section-label";

/**
 * Last-resort boundary: replaces the root layout, so it has to supply its own
 * <html>/<body> and can't rely on any provider or font from the layout.
 */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-primary p-6 text-primary">
        <div role="alert" className="max-w-md space-y-6 text-center">
          <SectionLabel>Error</SectionLabel>
          <h1 className="text-heading-xl">Pelago hit a snag</h1>
          <p className="text-body-lg text-secondary">
            Something went wrong loading the app. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="h-9 rounded-control bg-btn-primary px-3 text-body-md font-semibold text-btn-primary-text transition-colors duration-fast ease-standard hover:bg-btn-primary-hover"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
