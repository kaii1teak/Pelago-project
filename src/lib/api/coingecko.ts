import "server-only";
import type { z } from "zod";
import { ApiError } from "./errors";

const BASE = process.env.COINGECKO_API_BASE ?? "https://api.coingecko.com/api/v3";
const REQUEST_TIMEOUT_MS = 8_000;
const DEFAULT_RETRY_AFTER_S = 60;

type Params = Record<string, string | number | boolean | undefined>;

export type CgResult<T> = {
  data: T;
  /** True when the upstream failed and we served the last good response instead. */
  stale: boolean;
};

/**
 * Safety net on top of Next's data cache: if the upstream rate-limits or errors
 * *and* we've seen a good response for this exact URL, serve it (flagged stale)
 * rather than breaking the page. Per-instance memory, so it's best-effort on
 * serverless, but costs nothing and covers dev/self-hosted runs fully.
 */
const LAST_GOOD_MAX_AGE_MS = 30 * 60 * 1000;
/**
 * Capped, oldest out first. Most keys are a small fixed set (coins, ranges,
 * categories), but search queries are free text: without a cap, every distinct
 * query anyone types would stay in memory for the life of the instance.
 */
export const LAST_GOOD_MAX_ENTRIES = 300;
const lastGood = new Map<string, { data: unknown; at: number }>();

function rememberGood(key: string, data: unknown) {
  lastGood.delete(key); // re-inserting moves it to the "newest" end
  if (lastGood.size >= LAST_GOOD_MAX_ENTRIES) {
    const oldest = lastGood.keys().next().value;
    if (oldest !== undefined) lastGood.delete(oldest);
  }
  lastGood.set(key, { data, at: Date.now() });
}

/**
 * Remembers URLs the upstream said don't exist. Next doesn't cache 404s, and the
 * ids in coin URLs are user-controlled, so without this a caller could burn the
 * rate limit with made-up ids. A bad id costs one upstream call per instance
 * per TTL instead of one per request. (Unique bogus ids still each cost one;
 * stopping that needs rate limiting at the edge, not in app code.)
 */
const MISSING_TTL_MS = 10 * 60 * 1000;
const MISSING_MAX_ENTRIES = 500;
const missing = new Map<string, number>();

function isKnownMissing(key: string) {
  const expires = missing.get(key);
  if (expires === undefined) return false;
  if (expires < Date.now()) {
    missing.delete(key);
    return false;
  }
  return true;
}

function rememberMissing(key: string) {
  if (missing.size >= MISSING_MAX_ENTRIES) {
    const oldest = missing.keys().next().value;
    if (oldest !== undefined) missing.delete(oldest);
  }
  missing.set(key, Date.now() + MISSING_TTL_MS);
}

function buildUrl(path: string, params: Params = {}) {
  const url = new URL(`${BASE}${path}`);
  // Sorted so identical requests always produce an identical URL, which is the
  // data-cache key. Different param order must not mean a different cache entry.
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url;
}

function parseRetryAfter(header: string | null) {
  const seconds = header ? Number.parseInt(header, 10) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_AFTER_S;
}

/**
 * Fetch + validate one CoinGecko endpoint.
 *
 * - `revalidate` is the cache window in seconds. Next serves the cached copy
 *   (and refreshes it in the background once it's older), so N visitors cost
 *   at most one upstream call per window.
 * - The response is parsed through `schema`; anything that doesn't match is
 *   an `invalid_response`, never silently passed to the UI.
 */
export async function cgFetch<S extends z.ZodType>(
  path: string,
  schema: S,
  options: { params?: Params; revalidate: number; tags?: string[] },
): Promise<CgResult<z.output<S>>> {
  const url = buildUrl(path, options.params);
  const key = url.toString();

  const headers: Record<string, string> = { accept: "application/json" };
  const apiKey = process.env.COINGECKO_API_KEY;
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

  if (isKnownMissing(key)) throw new ApiError("not_found");

  const fallback = (error: ApiError): CgResult<z.output<S>> => {
    const cached = lastGood.get(key);
    if (cached && Date.now() - cached.at < LAST_GOOD_MAX_AGE_MS) {
      return { data: cached.data as z.output<S>, stale: true };
    }
    throw error;
  };

  let res: Response;
  try {
    res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: options.revalidate, tags: options.tags },
    });
  } catch {
    return fallback(new ApiError("network", "Couldn't reach the market data provider."));
  }

  if (res.status === 429) {
    return fallback(
      new ApiError("rate_limited", undefined, {
        retryAfter: parseRetryAfter(res.headers.get("retry-after")),
      }),
    );
  }
  if (res.status === 404) {
    rememberMissing(key);
    throw new ApiError("not_found");
  }
  if (res.status === 400) throw new ApiError("bad_request");
  if (res.status === 401 || res.status === 403) {
    // Almost always a bad/expired COINGECKO_API_KEY. Loud on the server, vague to the client.
    console.error(`[coingecko] ${res.status} for ${path}: check COINGECKO_API_KEY`);
    return fallback(new ApiError("upstream_error"));
  }
  if (!res.ok) return fallback(new ApiError("upstream_error"));

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return fallback(new ApiError("invalid_response"));
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.error(
      `[coingecko] unexpected response shape for ${path}:`,
      parsed.error.message,
    );
    return fallback(new ApiError("invalid_response"));
  }

  rememberGood(key, parsed.data);
  return { data: parsed.data, stale: false };
}

/** Test hook: the last-good map is module state. */
export function __resetLastGoodForTests() {
  lastGood.clear();
  missing.clear();
}
