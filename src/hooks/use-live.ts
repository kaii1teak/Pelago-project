"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { liveConnection, liveStore } from "@/lib/live/client";
import {
  isPlausible,
  liveChange24h,
  liveSymbol,
  type LiveSource,
} from "@/lib/live/symbols";
import type { Kline, LiveStatus, Tick } from "@/lib/live/types";

const noop = () => () => {};
const nothing = () => null;

/** The latest streamed trade of a symbol ("BTCUSDT"), or null while there is none. Re-renders only when THAT symbol's price moves. */
export function useLiveTick(symbol: string | null): Tick | null {
  const subscribe = useMemo(
    () => (symbol ? (cb: () => void) => liveStore.subscribeTick(symbol, cb) : noop),
    [symbol],
  );
  return useSyncExternalStore(
    subscribe,
    () => (symbol ? liveStore.getTick(symbol) : null),
    nothing,
  );
}

/** The symbol's current one-minute candle, streamed for as long as this is mounted. */
export function useLiveKline(symbol: string | null): Kline | null {
  const subscribe = useMemo(
    () => (symbol ? (cb: () => void) => liveStore.subscribeKline(symbol, cb) : noop),
    [symbol],
  );
  useEffect(() => (symbol ? liveConnection.watchKline(symbol) : undefined), [symbol]);
  return useSyncExternalStore(
    subscribe,
    () => (symbol ? liveStore.getKline(symbol) : null),
    nothing,
  );
}

/** Where the live feed stands. "idle" on the server and until something on screen asks for prices. */
export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(
    liveStore.subscribeStatus,
    liveStore.getStatus,
    () => "idle" as const,
  );
}

/** A coin's price and 24-hour change: the streamed ones when there are, otherwise what was last polled. */
export function useLiveCoin(source: LiveSource) {
  const symbol = liveSymbol(source.symbol, source.rank);
  const tick = useLiveTick(symbol);
  const live = tick && isPlausible(tick.price, source.price) ? tick.price : null;
  return {
    price: live ?? source.price,
    change24h:
      live === null
        ? (source.change24h ?? null)
        : (liveChange24h(live, source.price, source.change24h) ??
          source.change24h ??
          null),
    /** The price is a streamed one. */
    live: live !== null,
  };
}
