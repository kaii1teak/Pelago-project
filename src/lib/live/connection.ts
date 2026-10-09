import { klineStream, parseMessage } from "./messages";
import type { LiveStore } from "./store";
import { SOCKET_OPEN, type Kline, type SocketLike, type Tick } from "./types";

export type ConnectionOptions = {
  store: LiveStore;
  /** Tried in turn: the market-data-only host first, the main one when that fails. */
  urls: readonly string[];
  createSocket: (url: string) => SocketLike;
  /** Milliseconds; defaults to Date.now. */
  now?: () => number;
  random?: () => number;
  /** Runs `callback` on the next animation frame (setTimeout where there is none). */
  raf?: (callback: () => void) => void;
  /** At most one batch of ticks reaches the store per this many ms. */
  flushMs?: number;
  /** No frame for this long on an open socket: it is dead, whatever it says. */
  staleMs?: number;
  /** A socket that has not opened by now is given up on. */
  connectTimeoutMs?: number;
  /** The wait before the first retry; it doubles each time. */
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  /** Attempts in a row that never delivered a price before the status becomes "polling". */
  failuresBeforePolling?: number;
  /** How often the stream is retried once it is "polling". */
  pollingRetryMs?: number;
  /** A connection that lasted this long was a good one: its failure does not grow the backoff. */
  stableMs?: number;
};

const DEFAULTS = {
  flushMs: 1000,
  staleMs: 10_000,
  connectTimeoutMs: 10_000,
  baseBackoffMs: 1000,
  maxBackoffMs: 30_000,
  failuresBeforePolling: 3,
  pollingRetryMs: 60_000,
  stableMs: 5000,
} as const;

/**
 * The one WebSocket to Binance, for the whole app. It opens when something on screen wants
 * live prices and closes when nothing does; it is closed while the tab is in the background
 * and opened again, at once, when the tab returns; when it drops it reconnects with a
 * doubling, jittered pause; when it goes quiet it is declared dead (a socket can stay
 * "open" long after the network is gone); and when it can't be made to work at all it says
 * "polling" and tries again only once a minute, the rest of the app carrying on with its
 * ordinary once-a-minute refresh.
 *
 * Prices are not pushed to the screen as they arrive. They are kept in a buffer (the latest
 * per symbol) and handed to the store in one batch, at most once a second, on an animation
 * frame, so a feed of hundreds of messages never means hundreds of renders.
 */
export class LiveConnection {
  private o: Required<Omit<ConnectionOptions, "store" | "urls" | "createSocket">> &
    Pick<ConnectionOptions, "store" | "urls" | "createSocket">;
  private socket: SocketLike | null = null;
  private wanted = false; // something on screen wants live prices
  private hidden = false; // the tab is in the background
  private attempt = 0; // reconnects in a row: the backoff exponent
  private failures = 0; // attempts in a row that never delivered a price
  private urlIndex = 0;
  private gotData = false; // this socket has delivered a price
  private liveSince = 0;
  private lastMessageAt = 0;
  private connectTimer: ReturnType<typeof setTimeout> | undefined;
  private staleTimer: ReturnType<typeof setInterval> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private lastFlushAt = Number.NEGATIVE_INFINITY;
  private ticks = new Map<string, Tick>();
  private klines = new Map<string, Kline>();
  private klineRefs = new Map<string, number>();
  private nextId = 1;

  constructor(options: ConnectionOptions) {
    this.o = {
      now: Date.now,
      random: Math.random,
      raf: (callback) =>
        typeof requestAnimationFrame === "function"
          ? void requestAnimationFrame(callback)
          : void setTimeout(callback, 0),
      ...DEFAULTS,
      ...options,
    };
  }

  /* ---- what the app asks for ------------------------------------------- */

  /** Something wants live prices (true) or nothing does any more (false). */
  setWanted(wanted: boolean) {
    if (wanted === this.wanted) return;
    this.wanted = wanted;
    if (wanted) this.attempt = this.failures = 0;
    this.sync();
  }

  /** The tab went to the background (true) or came back (false). */
  setHidden(hidden: boolean) {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    // Coming back: forget old trouble and try straight away.
    if (!hidden) this.attempt = this.failures = 0;
    this.sync();
  }

  /** The network came back: try straight away rather than at the end of the backoff. */
  networkBack() {
    if (!this.wanted || this.hidden || this.socket) return;
    this.attempt = this.failures = 0;
    this.sync();
  }

  /** Keep a symbol's 1-minute candle coming (counted: two charts of one coin share it). */
  watchKline(symbol: string): () => void {
    this.klineRefs.set(symbol, (this.klineRefs.get(symbol) ?? 0) + 1);
    if ((this.klineRefs.get(symbol) ?? 0) === 1)
      this.send("SUBSCRIBE", [klineStream(symbol)]);
    return () => {
      const left = (this.klineRefs.get(symbol) ?? 1) - 1;
      if (left > 0) {
        this.klineRefs.set(symbol, left);
        return;
      }
      this.klineRefs.delete(symbol);
      this.send("UNSUBSCRIBE", [klineStream(symbol)]);
      this.klines.delete(symbol);
    };
  }

  /** Close everything for good (the app is going away). */
  dispose() {
    this.wanted = false;
    this.sync();
    this.klineRefs.clear();
    this.ticks.clear();
    this.klines.clear();
  }

  /* ---- state ----------------------------------------------------------- */

  /** Makes the socket match what is wanted: open, closed, or waiting. */
  private sync() {
    const { store } = this.o;
    if (!this.wanted) {
      this.teardown();
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
      store.setStatus("idle");
      return;
    }
    if (this.hidden) {
      this.teardown();
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
      store.setStatus("paused");
      return;
    }
    if (this.socket || this.reconnectTimer) return;
    this.connect();
  }

  private connect() {
    const { store, urls, createSocket } = this.o;
    store.setStatus(
      this.attempt === 0 && this.failures === 0 ? "connecting" : this.status(),
    );
    const url = urls[this.urlIndex % urls.length]!;
    let socket: SocketLike;
    try {
      socket = createSocket(url);
    } catch {
      this.afterFailure();
      return;
    }
    this.socket = socket;
    this.gotData = false;

    this.connectTimer = setTimeout(() => this.fail(socket), this.o.connectTimeoutMs);

    socket.onopen = () => {
      if (this.socket !== socket) return;
      clearTimeout(this.connectTimer);
      this.lastMessageAt = this.o.now();
      this.staleTimer = setInterval(
        () => {
          if (this.o.now() - this.lastMessageAt > this.o.staleMs) this.fail(socket);
        },
        Math.max(250, Math.floor(this.o.staleMs / 5)),
      );
      // The all-symbols ticker is part of the address; candles are asked for after.
      const klines = [...this.klineRefs.keys()].map(klineStream);
      if (klines.length) this.send("SUBSCRIBE", klines);
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      this.lastMessageAt = this.o.now();
      const message = parseMessage(event.data);
      if (!message) return;
      if (!this.gotData) {
        this.gotData = true;
        this.liveSince = this.o.now();
        this.failures = 0;
        store.setStatus("live");
      }
      if (message.type === "tickers") {
        for (const [symbol, tick] of message.ticks) {
          if (store.isWatched(symbol)) this.ticks.set(symbol, tick);
        }
      } else if (this.klineRefs.has(message.symbol)) {
        this.klines.set(message.symbol, message.kline);
      }
      this.scheduleFlush();
    };
    // `error` is always followed by `close`; the close does the work.
    socket.onerror = () => {};
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.clearSocketTimers();
      this.afterFailure();
    };
  }

  /** The socket is no good (silent, or never opened): drop it and go through the usual failure path. */
  private fail(socket: SocketLike) {
    if (this.socket !== socket) return;
    this.socket = null;
    this.clearSocketTimers();
    detach(socket);
    try {
      socket.close();
    } catch {
      // already gone
    }
    this.afterFailure();
  }

  private afterFailure() {
    if (!this.wanted || this.hidden) return;
    const wasGood = this.gotData;
    if (wasGood) {
      // It worked: a long run is forgiven, a short one is not (no hammering a flapping link).
      this.failures = 0;
      if (this.o.now() - this.liveSince > this.o.stableMs) this.attempt = 0;
    } else {
      this.failures++;
    }
    this.gotData = false;
    this.attempt++;
    this.urlIndex++; // the other address next

    const giveUp = this.failures >= this.o.failuresBeforePolling;
    this.o.store.setStatus(giveUp ? "polling" : "reconnecting");
    if (giveUp) this.o.store.clearData();

    const delay = giveUp ? this.o.pollingRetryMs : this.backoff();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.wanted && !this.hidden && !this.socket) this.connect();
    }, delay);
  }

  /** 1s, 2s, 4s ... up to 30s, each cut by a random share so many tabs don't retry in step. */
  private backoff() {
    const exponential = this.o.baseBackoffMs * 2 ** Math.max(0, this.attempt - 1);
    return Math.min(this.o.maxBackoffMs, exponential) * (0.5 + this.o.random() * 0.5);
  }

  private status() {
    return this.failures >= this.o.failuresBeforePolling ? "polling" : "reconnecting";
  }

  /** Close the socket for good reason (nothing wants it, or the tab is hidden). */
  private teardown() {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    this.clearSocketTimers();
    this.ticks.clear();
    this.klines.clear();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      detach(socket);
      try {
        socket.close(1000, "done");
      } catch {
        // already gone
      }
    }
    this.o.store.clearData();
  }

  private clearSocketTimers() {
    clearTimeout(this.connectTimer);
    clearInterval(this.staleTimer);
    this.connectTimer = this.staleTimer = undefined;
  }

  private send(method: "SUBSCRIBE" | "UNSUBSCRIBE", params: string[]) {
    if (this.socket?.readyState !== SOCKET_OPEN) return; // sent on open, from klineRefs
    this.socket.send(JSON.stringify({ method, params, id: this.nextId++ }));
  }

  /* ---- batching -------------------------------------------------------- */

  private scheduleFlush() {
    if (this.flushTimer) return;
    const wait = Math.max(0, this.o.flushMs - (this.o.now() - this.lastFlushAt));
    this.flushTimer = setTimeout(() => {
      this.o.raf(() => {
        this.flushTimer = undefined;
        this.flush();
      });
    }, wait);
  }

  private flush() {
    this.lastFlushAt = this.o.now();
    if (!this.socket && !this.ticks.size && !this.klines.size) return;
    const ticks = this.ticks;
    const klines = this.klines;
    this.ticks = new Map();
    this.klines = new Map();
    if (ticks.size) this.o.store.applyTicks(ticks);
    if (klines.size) this.o.store.applyKlines(klines);
  }
}

function detach(socket: SocketLike) {
  socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
}
