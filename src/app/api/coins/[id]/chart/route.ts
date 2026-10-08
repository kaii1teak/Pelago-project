import type { NextRequest } from "next/server";
import { CHART_REVALIDATE, HISTORY_REVALIDATE, getCoinChart } from "@/lib/api/endpoints";
import { errorResponse, jsonResponse } from "@/lib/api/http";
import { parseChartBack, parseChartRange, parseCoinId } from "@/lib/api/parse-coin";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/coins/[id]/chart">,
) {
  try {
    const id = parseCoinId((await ctx.params).id);
    const range = parseChartRange(request.nextUrl.searchParams);
    const back = parseChartBack(request.nextUrl.searchParams, range);
    const { data, stale } = await getCoinChart(id, range, back);
    return jsonResponse(data, {
      sMaxAge: back === 0 ? CHART_REVALIDATE[range] : HISTORY_REVALIDATE,
      stale,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
