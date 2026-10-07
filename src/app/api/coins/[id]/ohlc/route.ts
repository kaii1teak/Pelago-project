import type { NextRequest } from "next/server";
import { CHART_REVALIDATE, getCoinOhlc } from "@/lib/api/endpoints";
import { errorResponse, jsonResponse } from "@/lib/api/http";
import { parseChartRange, parseCoinId } from "@/lib/api/parse-coin";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/coins/[id]/ohlc">,
) {
  try {
    const id = parseCoinId((await ctx.params).id);
    const range = parseChartRange(request.nextUrl.searchParams);
    const { data, stale } = await getCoinOhlc(id, range);
    return jsonResponse(data, { sMaxAge: CHART_REVALIDATE[range], stale });
  } catch (error) {
    return errorResponse(error);
  }
}
