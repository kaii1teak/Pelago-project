"use client";

import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/**
 * Content that replaces a skeleton eases in instead of popping. It does nothing when it is
 * hydrating server HTML: that content is already on screen, and an entrance animation would
 * hide it for a moment (and delay the first paint). The skeleton has the same size as the
 * content, so nothing moves while it fades.
 *
 * Whether this render is hydrating is told by useSyncExternalStore: it answers with the
 * server's value while hydrating and with the browser's value in any render that is not.
 * (Not a flag set when the page loaded: a part of the page inside a Suspense hydrates later
 * than the page's own first commit, and a flag would call it a fresh mount, give it a class
 * the server HTML doesn't have and make React warn about the mismatch.)
 */
export function FadeIn({ className, ...props }: React.ComponentProps<"div">) {
  const hydrating = useSyncExternalStore(
    noop,
    () => false,
    () => true,
  );
  // Fixed by the first render: hydrating finishes with a second render that must not animate.
  const [enters] = useState(!hydrating);
  return <div className={cn(enters && "animate-fade-in", className)} {...props} />;
}
