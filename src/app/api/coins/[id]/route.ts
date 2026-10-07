import { REVALIDATE, getCoin } from "@/lib/api/endpoints";
import { errorResponse, jsonResponse } from "@/lib/api/http";
import { parseCoinId } from "@/lib/api/parse-coin";

export async function GET(_request: Request, ctx: RouteContext<"/api/coins/[id]">) {
  try {
    const id = parseCoinId((await ctx.params).id);
    const { data, stale } = await getCoin(id);
    return jsonResponse(data, { sMaxAge: REVALIDATE.coin, stale });
  } catch (error) {
    return errorResponse(error);
  }
}
