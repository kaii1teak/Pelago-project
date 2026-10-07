import { z } from "zod";
import { isCategoryId } from "@/lib/categories";
import { ApiError } from "./errors";
import {
  DEFAULT_PER_PAGE,
  MAX_IDS,
  PER_PAGE_OPTIONS,
  type MarketsParams,
} from "./markets-query";

// These values are interpolated into an upstream URL and double as cache keys,
// so they're constrained tightly: unbounded input would let a caller bypass
// the cache with endless unique requests and burn the API quota. Categories are
// an allowlist (not a pattern) for the same reason.
const COIN_ID = /^[a-z0-9][a-z0-9._-]{0,99}$/;

const schema = z.object({
  ids: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.string().regex(COIN_ID)).max(MAX_IDS))
    .optional(),
  category: z.string().refine(isCategoryId).optional(),
  page: z.coerce.number().int().min(1).max(40).default(1),
  per_page: z.coerce
    .number()
    .int()
    .refine((n) => (PER_PAGE_OPTIONS as readonly number[]).includes(n))
    .default(DEFAULT_PER_PAGE),
});

/** Parse and validate the query string of a /api/markets request. */
export function parseMarketsParams(searchParams: URLSearchParams): MarketsParams {
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) throw new ApiError("bad_request");
  const { ids, category, page, per_page } = parsed.data;
  return { ids, category, page, perPage: per_page };
}
