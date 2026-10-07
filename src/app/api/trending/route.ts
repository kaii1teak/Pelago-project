import { REVALIDATE, getTrending } from "@/lib/api/endpoints";
import { errorResponse, jsonResponse } from "@/lib/api/http";

export async function GET() {
  try {
    const { data, stale } = await getTrending();
    return jsonResponse(data, { sMaxAge: REVALIDATE.trending, stale });
  } catch (error) {
    return errorResponse(error);
  }
}
