import { REVALIDATE, getGlobalStats } from "@/lib/api/endpoints";
import { errorResponse, jsonResponse } from "@/lib/api/http";

export async function GET() {
  try {
    const { data, stale } = await getGlobalStats();
    return jsonResponse(data, { sMaxAge: REVALIDATE.global, stale });
  } catch (error) {
    return errorResponse(error);
  }
}
