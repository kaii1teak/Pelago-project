/**
 * Where the live feed stands, for the status light:
 *  idle         nothing on screen wants live prices (no socket is open)
 *  connecting   the first connection is being made
 *  live         prices are streaming
 *  reconnecting the stream dropped; trying again with a growing pause
 *  paused       the tab is in the background; the socket is closed until it returns
 *  polling      the stream can't be reached (blocked, offline): prices refresh once a
 *               minute through the normal API instead, and the stream is retried slowly
 */
export type LiveStatus =
  "idle" | "connecting" | "live" | "reconnecting" | "paused" | "polling";

/** The latest trade price of one symbol. */
export type Tick = { price: number; time: number };

/** The current 1-minute candle of one symbol. Times are milliseconds. */
export type Kline = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

/** The slice of the browser's WebSocket the connection uses (tests pass a fake). */
export type SocketLike = {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: { code?: number }) => void) | null;
};

export const SOCKET_OPEN = 1;
