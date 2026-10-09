import type { NextRequest } from "next/server";
import { REVALIDATE, getHeatmap } from "@/lib/api/endpoints";
import { errorResponse, jsonResponse } from "@/lib/api/http";
import { parseHeatmapParams } from "@/lib/api/parse-heatmap";

export async function GET(request: NextRequest) {
  try {
    const { category } = parseHeatmapParams(request.nextUrl.searchParams);
    const { data, stale } = await getHeatmap(category);
    return jsonResponse(data, { sMaxAge: REVALIDATE.heatmap, stale });
  } catch (error) {
    return errorResponse(error);
  }
}
