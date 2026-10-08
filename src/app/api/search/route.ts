import type { NextRequest } from "next/server";
import { REVALIDATE, getSearch } from "@/lib/api/endpoints";
import { errorResponse, jsonResponse } from "@/lib/api/http";
import { parseSearchQuery } from "@/lib/api/parse-search";

export async function GET(request: NextRequest) {
  try {
    const query = parseSearchQuery(request.nextUrl.searchParams);
    const { data, stale } = await getSearch(query);
    return jsonResponse(data, { sMaxAge: REVALIDATE.search, stale });
  } catch (error) {
    return errorResponse(error);
  }
}
