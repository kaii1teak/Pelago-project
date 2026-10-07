"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/api/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // getQueryClient is a browser singleton; on the server it's per-render.
  const client = getQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
