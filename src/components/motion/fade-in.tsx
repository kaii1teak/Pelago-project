"use client";

import { useState } from "react";
import { isFirstPage } from "@/lib/session-state";
import { cn } from "@/lib/utils";

/**
 * Content that replaces a skeleton eases in instead of popping. It does nothing on the
 * first page of a visit: there the content is already in the server HTML, and an
 * entrance animation would hide it for a moment (and delay the first paint).
 * The skeleton has the same size as the content, so nothing moves while it fades.
 */
export function FadeIn({ className, ...props }: React.ComponentProps<"div">) {
  const [enters] = useState(() => !isFirstPage());
  return <div className={cn(enters && "animate-fade-in", className)} {...props} />;
}
