import { z } from "zod";
import { isCategoryId } from "@/lib/categories";
import { ApiError } from "./errors";

// The only input is a category, and it is an allowlist (not a pattern): it is interpolated
// into an upstream URL and is the cache key, so an invented one would cost a request.
const schema = z.object({
  category: z.string().refine(isCategoryId).optional(),
});

/** Parse and validate the query string of a /api/heatmap request. */
export function parseHeatmapParams(searchParams: URLSearchParams): {
  category?: string;
} {
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) throw new ApiError("bad_request");
  return { category: parsed.data.category };
}
