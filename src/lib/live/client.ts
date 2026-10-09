import { LiveConnection } from "./connection";
import { LiveStore } from "./store";
import type { SocketLike } from "./types";

/**
 * The market-data-only host first (no trading, no account: the public prices), then the
 * main one, which some networks reach when the other is blocked and some the other way round.
 * The all-symbols mini ticker is part of the address; candles are asked for later.
 */
export const LIVE_URLS = [
  "wss://data-stream.binance.vision/stream?streams=!miniTicker@arr",
  "wss://stream.binance.com:9443/stream?streams=!miniTicker@arr",
] as const;

/** The one store and the one connection of the app (the browser's side; the server never opens a socket). */
export const liveStore = new LiveStore();

export const liveConnection = new LiveConnection({
  store: liveStore,
  urls: LIVE_URLS,
  createSocket: (url) => new WebSocket(url) as unknown as SocketLike,
});

// The socket is open exactly while something on screen shows a live price.
liveStore.onDemand((subscribers) => liveConnection.setWanted(subscribers > 0));

/**
 * Starts listening to what the browser knows about the tab and the network: a tab in the
 * background closes the socket, a returning one reopens it, and coming back online retries
 * at once. Returns the undo.
 */
export function attachBrowserEvents(): () => void {
  const onVisibility = () =>
    liveConnection.setHidden(document.visibilityState === "hidden");
  const onOnline = () => liveConnection.networkBack();
  onVisibility();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onOnline);
  };
}
