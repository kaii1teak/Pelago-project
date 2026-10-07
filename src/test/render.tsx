import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/errors";

/** No retries/backoff in tests: a failed query should fail immediately. */
export function makeTestClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  });
}

/**
 * Render with a query cache you can pre-seed. `staleTime: Infinity` means seeded
 * data is considered fresh, so components render it without touching the network.
 */
export function renderWithClient(
  ui: React.ReactElement,
  seed?: (client: QueryClient) => void,
) {
  const client = makeTestClient();
  seed?.(client);
  const result = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
  return { client, ...result };
}

type Routes = Record<string, "pending" | "fail" | unknown>;

/**
 * Stub fetch with per-URL behaviour: a value -> 200 JSON, "fail" -> a 502
 * ApiError body, "pending" -> never resolves (to hold a loading state).
 */
export function mockApi(routes: Routes) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(routes).find(
      (route) => url === route || url.startsWith(route),
    );
    const behaviour = key ? routes[key] : undefined;
    if (behaviour === "pending") return new Promise<Response>(() => {});
    if (behaviour === "fail" || behaviour === undefined) {
      const error = new ApiError("upstream_error");
      return new Response(JSON.stringify(error.toBody()), { status: error.status });
    }
    return new Response(JSON.stringify(behaviour), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
