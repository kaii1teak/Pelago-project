import { ApiError } from "./errors";

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 40;

/** Letters, digits, spaces and the few separators coin names use. */
const ALLOWED = /^[\p{L}\p{N} ._-]+$/u;

/**
 * The search text becomes an upstream URL and a cache key, so it is reduced to
 * one canonical form (trimmed, single spaces, lower case: "Bit  coin" and
 * "bit coin" are the same entry) and anything outside a narrow alphabet is
 * rejected rather than forwarded.
 */
export function normalizeSearchText(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseSearchQuery(searchParams: URLSearchParams): string {
  const q = normalizeSearchText(searchParams.get("q") ?? "");
  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH || !ALLOWED.test(q)) {
    throw new ApiError("bad_request");
  }
  return q;
}
