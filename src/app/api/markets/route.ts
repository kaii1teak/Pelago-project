import type { NextRequest } from "next/server";
import { REVALIDATE, getMarkets } from "@/lib/api/endpoints";
import { errorResponse, jsonResponse } from "@/lib/api/http";
import { parseMarketsParams } from "@/lib/api/parse-markets";

export async function GET(request: NextRequest) {
  try {
    const params = parseMarketsParams(request.nextUrl.searchParams);
    const { data, stale } = await getMarkets(params);
    return jsonResponse(data, { sMaxAge: REVALIDATE.markets, stale });
  } catch (error) {
    return errorResponse(error);
  }
}
