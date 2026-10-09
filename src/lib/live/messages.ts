import type { Kline, Tick } from "./types";

export type TickerMessage = { type: "tickers"; ticks: Map<string, Tick> };
export type KlineMessage = { type: "kline"; symbol: string; kline: Kline };
export type LiveMessage = TickerMessage | KlineMessage;

const num = (value: unknown): number | null => {
  const n = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** The streams used: every symbol's mini ticker in one array, and one symbol's 1-minute candle. */
export const TICKER_STREAM = "!miniTicker@arr";
export const klineStream = (symbol: string) => `${symbol.toLowerCase()}@kline_1m`;

/**
 * Reads one text frame from the socket into what the app understands, or null for
 * anything else (subscription acknowledgements, junk, shapes that aren't ours). Binance
 * wraps payloads as { stream, data } on a combined stream and sends them bare on a raw
 * one; both are accepted. Only USDT pairs are kept: they are the dollar prices.
 */
export function parseMessage(raw: unknown): LiveMessage | null {
  if (typeof raw !== "string") return null;
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  const body =
    message && typeof message === "object" && "stream" in message && "data" in message
      ? (message as { data: unknown }).data
      : message;

  if (Array.isArray(body)) {
    const ticks = new Map<string, Tick>();
    for (const item of body) {
      if (!item || typeof item !== "object") continue;
      const { s, c, E } = item as { s?: unknown; c?: unknown; E?: unknown };
      const price = num(c);
      if (typeof s !== "string" || !s.endsWith("USDT") || price === null || price <= 0)
        continue;
      ticks.set(s, { price, time: num(E) ?? 0 });
    }
    return ticks.size ? { type: "tickers", ticks } : null;
  }

  if (body && typeof body === "object" && (body as { e?: unknown }).e === "kline") {
    const { s, k } = body as { s?: unknown; k?: Record<string, unknown> };
    if (typeof s !== "string" || !s.endsWith("USDT") || !k) return null;
    const open = num(k.o);
    const high = num(k.h);
    const low = num(k.l);
    const close = num(k.c);
    const openTime = num(k.t);
    if (
      open === null ||
      high === null ||
      low === null ||
      close === null ||
      openTime === null
    ) {
      return null;
    }
    return { type: "kline", symbol: s, kline: { openTime, open, high, low, close } };
  }
  return null;
}
