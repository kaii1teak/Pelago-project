import { QueryClient, isServer } from "@tanstack/react-query";
import { isApiError } from "./errors";

const MAX_RETRIES = 2;
/** How long fetched data counts as fresh: no refetch on mount or on a new observer within it. */
export const STALE_TIME_MS = 2 * 60_000;
/** Longest we'll keep a skeleton on screen waiting out a rate limit. */
const MAX_SILENT_WAIT_MS = 5_000;

const waitFor = (error: unknown) =>
  isApiError(error) && error.retryAfter ? error.retryAfter * 1000 : 0;

export function shouldRetry(failureCount: number, error: unknown) {
  if (isApiError(error) && !error.retryable) return false;
  // Told to wait longer than a person will stare at a skeleton? Show the error
  // (with its Retry button) now instead of retrying invisibly for a minute.
  if (waitFor(error) > MAX_SILENT_WAIT_MS) return false;
  return failureCount < MAX_RETRIES;
}

export function retryDelay(attempt: number, error: unknown) {
  // If the upstream told us how long to back off, respect it.
  const asked = waitFor(error);
  if (asked) return asked;
  return Math.min(1000 * 2 ** attempt, 8_000) + Math.random() * 300;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The server's own cache windows are 1 to 5 minutes, so asking again sooner can't
        // return newer data. And a page that arrives with its data already in it (the HTML
        // is up to a minute or two old) must not ask for it all again the moment it loads:
        // that was a refetch of the whole markets list (70 KB) on every visit. The lists
        // still refresh every minute on their own timer, and live prices come by socket.
        staleTime: STALE_TIME_MS,
        gcTime: 10 * 60_000,
        retry: shouldRetry,
        retryDelay,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/**
 * Server: a fresh client per call (never share cache between users' requests).
 * Browser: a singleton, so React suspending during the initial render can't
 * throw away the cache.
 */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  return (browserClient ??= makeQueryClient());
}
