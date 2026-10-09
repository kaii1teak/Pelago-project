import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveConnection, type ConnectionOptions } from "./connection";
import { LiveStore } from "./store";
import { SOCKET_OPEN, type SocketLike } from "./types";

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: { method: string; params: string[] }[] = [];
  closed = false;
  onopen: SocketLike["onopen"] = null;
  onmessage: SocketLike["onmessage"] = null;
  onerror: SocketLike["onerror"] = null;
  onclose: SocketLike["onclose"] = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  /* what the network does */
  open() {
    this.readyState = SOCKET_OPEN;
    this.onopen?.({});
  }
  say(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
  tickers(...entries: [string, string][]) {
    this.say({
      stream: "!miniTicker@arr",
      data: entries.map(([s, c]) => ({ e: "24hrMiniTicker", s, c, E: Date.now() })),
    });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
}

const last = () => FakeSocket.all.at(-1)!;
const URLS = [
  "wss://primary/stream?streams=!miniTicker@arr",
  "wss://secondary/stream?streams=!miniTicker@arr",
];

function setup(options: Partial<ConnectionOptions> = {}) {
  const store = new LiveStore();
  const connection = new LiveConnection({
    store,
    urls: URLS,
    createSocket: (url) => new FakeSocket(url),
    random: () => 1, // no cut from the backoff: the waits below are the full ones
    raf: (callback) => callback(),
    ...options,
  });
  return { store, connection };
}

/** Something on screen is showing these symbols. */
const watch = (store: LiveStore, ...symbols: string[]) =>
  symbols.map((s) => store.subscribeTick(s, () => {}));

beforeEach(() => {
  FakeSocket.all = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("LiveConnection: opening and closing with demand", () => {
  it("opens nothing until something wants live prices", () => {
    setup();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.all).toHaveLength(0);
  });

  it("connects when wanted, to the first address, and is 'live' once a price arrives", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    expect(FakeSocket.all).toHaveLength(1);
    expect(last().url).toBe(URLS[0]);
    expect(store.getStatus()).toBe("connecting");
    last().open();
    expect(store.getStatus()).toBe("connecting"); // open is not yet "prices are flowing"
    last().tickers(["BTCUSDT", "81000"]);
    expect(store.getStatus()).toBe("live");
  });

  it("never has two sockets, however often it is asked", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    connection.setWanted(true);
    connection.setHidden(false);
    connection.networkBack();
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("closes when nothing wants prices any more, and is idle", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    const socket = last();
    connection.setWanted(false);
    expect(socket.closed).toBe(true);
    expect(store.getStatus()).toBe("idle");
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.all).toHaveLength(1); // and does not come back
  });

  it("forgets the old prices when it closes (they'd be stale on return)", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    last().tickers(["BTCUSDT", "81000"]);
    vi.advanceTimersByTime(1000);
    expect(store.getTick("BTCUSDT")).not.toBeNull();
    connection.setWanted(false);
    expect(store.getTick("BTCUSDT")).toBeNull();
  });
});

describe("LiveConnection: batching", () => {
  it("hands prices to the store in one batch a second, the latest per symbol", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT", "ETHUSDT");
    const applied = vi.spyOn(store, "applyTicks");
    connection.setWanted(true);
    last().open();

    // The first batch goes out at once (nothing was sent before)...
    last().tickers(["BTCUSDT", "80000"]);
    vi.advanceTimersByTime(0);
    expect(applied).toHaveBeenCalledTimes(1);

    // ...then a flood of frames inside one second becomes ONE batch, newest price winning.
    for (let i = 1; i <= 50; i++)
      last().tickers(["BTCUSDT", String(80000 + i)], ["ETHUSDT", String(2000 + i)]);
    vi.advanceTimersByTime(900);
    expect(applied).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    expect(applied).toHaveBeenCalledTimes(2);
    const batch = applied.mock.calls[1]![0];
    expect(batch.get("BTCUSDT")?.price).toBe(80050);
    expect(batch.get("ETHUSDT")?.price).toBe(2050);
  });

  it("waits for an animation frame to deliver", () => {
    let frame: (() => void) | null = null;
    const { store, connection } = setup({ raf: (callback) => void (frame = callback) });
    watch(store, "BTCUSDT");
    const applied = vi.spyOn(store, "applyTicks");
    connection.setWanted(true);
    last().open();
    last().tickers(["BTCUSDT", "80000"]);
    vi.advanceTimersByTime(1500);
    expect(applied).not.toHaveBeenCalled();
    frame!();
    expect(applied).toHaveBeenCalledTimes(1);
  });

  it("keeps only the symbols something is showing", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    const applied = vi.spyOn(store, "applyTicks");
    connection.setWanted(true);
    last().open();
    last().tickers(["BTCUSDT", "80000"], ["DOGEUSDT", "0.1"], ["XRPUSDT", "1.4"]);
    vi.advanceTimersByTime(1000);
    expect([...applied.mock.calls[0]![0].keys()]).toEqual(["BTCUSDT"]);
  });

  it("ignores frames that make no sense, without breaking", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    last().onmessage?.({ data: "not json" });
    last().say({ result: null, id: 1 });
    last().onmessage?.({ data: new ArrayBuffer(4) });
    expect(store.getStatus()).toBe("connecting");
    last().tickers(["BTCUSDT", "80000"]);
    expect(store.getStatus()).toBe("live");
  });
});

describe("LiveConnection: candles", () => {
  const klineFrame = (symbol: string, close: string) => ({
    stream: `${symbol.toLowerCase()}@kline_1m`,
    data: { e: "kline", s: symbol, k: { t: 1, o: "1", h: "2", l: "0.5", c: close } },
  });

  it("asks for a symbol's candle when watched and cancels it when not", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    const stop = connection.watchKline("BTCUSDT");
    expect(last().sent).toEqual([
      { method: "SUBSCRIBE", params: ["btcusdt@kline_1m"], id: 1 },
    ]);
    stop();
    expect(last().sent.at(-1)).toMatchObject({
      method: "UNSUBSCRIBE",
      params: ["btcusdt@kline_1m"],
    });
  });

  it("shares one subscription between two watchers of a symbol", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    const a = connection.watchKline("BTCUSDT");
    const b = connection.watchKline("BTCUSDT");
    expect(last().sent).toHaveLength(1);
    a();
    expect(last().sent).toHaveLength(1);
    b();
    expect(last().sent).toHaveLength(2);
  });

  it("asks again for the candles that are wanted when it reconnects", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    connection.watchKline("BTCUSDT");
    last().drop();
    vi.advanceTimersByTime(1000);
    last().open();
    expect(last().sent).toEqual([
      { method: "SUBSCRIBE", params: ["btcusdt@kline_1m"], id: 2 },
    ]);
  });

  it("delivers a candle only while it is wanted", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    const applied = vi.spyOn(store, "applyKlines");
    connection.setWanted(true);
    last().open();
    last().say(klineFrame("BTCUSDT", "1.5"));
    vi.advanceTimersByTime(1000);
    expect(applied).not.toHaveBeenCalled();
    connection.watchKline("BTCUSDT");
    last().say(klineFrame("BTCUSDT", "1.6"));
    vi.advanceTimersByTime(1000);
    expect(applied.mock.calls[0]![0].get("BTCUSDT")?.close).toBe(1.6);
  });
});

describe("LiveConnection: reconnecting", () => {
  /** A connection that came up, delivered prices and stayed a while. */
  function goodConnection() {
    const ctx = setup();
    watch(ctx.store, "BTCUSDT");
    ctx.connection.setWanted(true);
    last().open();
    last().tickers(["BTCUSDT", "80000"]);
    vi.advanceTimersByTime(6000);
    last().tickers(["BTCUSDT", "80001"]);
    return ctx;
  }

  it("says 'reconnecting' and tries again after a second", () => {
    const { store } = goodConnection();
    last().drop();
    expect(store.getStatus()).toBe("reconnecting");
    vi.advanceTimersByTime(999);
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("waits twice as long each time it fails to come back, up to half a minute", () => {
    const { connection } = setup();
    watch(connection["o"].store, "BTCUSDT");
    connection.setWanted(true); // attempt 1, never opens
    const gaps: number[] = [];
    let at = 0;
    for (let i = 0; i < 2; i++) {
      // each failed connect: let it time out, then record the wait before the next socket
      const sockets = FakeSocket.all.length;
      vi.advanceTimersByTime(10_000); // connect timeout
      at = Date.now();
      while (FakeSocket.all.length === sockets) vi.advanceTimersByTime(250);
      gaps.push(Date.now() - at);
    }
    expect(gaps[0]).toBeGreaterThanOrEqual(1000);
    expect(gaps[0]).toBeLessThan(1500);
    expect(gaps[1]).toBeGreaterThanOrEqual(2000);
    expect(gaps[1]).toBeLessThan(2500);
  });

  it("cuts each wait by a random share, so many tabs don't all retry at once", () => {
    const { store, connection } = setup({ random: () => 0 });
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    last().tickers(["BTCUSDT", "1"]);
    vi.advanceTimersByTime(6000);
    last().drop();
    vi.advanceTimersByTime(499);
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(FakeSocket.all).toHaveLength(2); // half of the full second
  });

  it("alternates between the two addresses", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    expect(last().url).toBe(URLS[0]);
    last().drop();
    vi.advanceTimersByTime(1000);
    expect(last().url).toBe(URLS[1]);
    last().drop();
    vi.advanceTimersByTime(2000);
    expect(last().url).toBe(URLS[0]);
  });

  it("starts again from a one second wait after a connection that lasted", () => {
    const { store } = goodConnection();
    last().drop();
    vi.advanceTimersByTime(1000);
    last().open();
    last().tickers(["BTCUSDT", "80002"]);
    vi.advanceTimersByTime(6000);
    last().drop();
    expect(store.getStatus()).toBe("reconnecting");
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.all).toHaveLength(3);
  });

  it("does not forgive a connection that dropped right after opening (a flapping link)", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    for (const wait of [1000, 2000, 4000]) {
      const count = FakeSocket.all.length;
      last().open();
      last().tickers(["BTCUSDT", "1"]);
      last().drop(); // gone within the second
      vi.advanceTimersByTime(wait - 1);
      expect(FakeSocket.all).toHaveLength(count);
      vi.advanceTimersByTime(2);
      expect(FakeSocket.all).toHaveLength(count + 1);
    }
  });

  it("ignores what an abandoned socket says", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    const old = last();
    old.open();
    old.drop();
    vi.advanceTimersByTime(1000);
    old.tickers(["BTCUSDT", "99999"]);
    expect(store.getStatus()).not.toBe("live");
  });
});

describe("LiveConnection: dead sockets", () => {
  it("gives up on a socket that never opens, and tries the other address", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    const first = last();
    vi.advanceTimersByTime(10_000);
    expect(first.closed).toBe(true);
    expect(store.getStatus()).toBe("reconnecting");
    vi.advanceTimersByTime(1000);
    expect(last().url).toBe(URLS[1]);
  });

  it("declares an open socket dead when no frame comes for ten seconds", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    last().tickers(["BTCUSDT", "1"]);
    const socket = last();
    vi.advanceTimersByTime(9000);
    expect(socket.closed).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(socket.closed).toBe(true);
    expect(store.getStatus()).toBe("reconnecting");
  });

  it("keeps a socket alive as long as frames keep coming", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    const socket = last();
    for (let i = 0; i < 20; i++) {
      socket.tickers(["BTCUSDT", String(i + 1)]);
      vi.advanceTimersByTime(5000);
    }
    expect(socket.closed).toBe(false);
    expect(store.getStatus()).toBe("live");
  });
});

describe("LiveConnection: giving up (blocked network)", () => {
  /** The network refuses `times` attempts in a row: each socket is dropped as soon as it appears. */
  function failTimes(connection: LiveConnection, times: number) {
    connection.setWanted(true);
    for (let i = 1; i <= times; i++) {
      const sockets = FakeSocket.all.length;
      last().drop();
      if (i === times) break; // the wait after the last one is the test's business
      let guard = 0;
      while (FakeSocket.all.length === sockets && guard++ < 400)
        vi.advanceTimersByTime(250);
    }
  }

  it("says 'polling' after three attempts that never delivered a price", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().drop();
    expect(store.getStatus()).toBe("reconnecting");
    vi.advanceTimersByTime(1000);
    last().drop();
    expect(store.getStatus()).toBe("reconnecting");
    vi.advanceTimersByTime(2000);
    last().drop();
    expect(store.getStatus()).toBe("polling");
  });

  it("then tries only once a minute", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    failTimes(connection, 3);
    expect(store.getStatus()).toBe("polling");
    const count = FakeSocket.all.length;
    vi.advanceTimersByTime(59_000);
    expect(FakeSocket.all).toHaveLength(count);
    vi.advanceTimersByTime(2000);
    expect(FakeSocket.all).toHaveLength(count + 1);
  });

  it("goes live after all, if a later try works", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    failTimes(connection, 3);
    vi.advanceTimersByTime(61_000);
    last().open();
    last().tickers(["BTCUSDT", "80000"]);
    expect(store.getStatus()).toBe("live");
  });

  it("does not give up on a link that did work, dropped, and came back again and again", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    for (let i = 0; i < 6; i++) {
      last().open();
      last().tickers(["BTCUSDT", String(i + 1)]);
      vi.advanceTimersByTime(6000); // a good run
      last().drop();
      expect(store.getStatus()).toBe("reconnecting");
      vi.advanceTimersByTime(1000); // the one-second wait, every time
    }
    expect(FakeSocket.all).toHaveLength(7);
  });
});

describe("LiveConnection: background tabs", () => {
  it("closes the socket when the tab goes to the background, and says 'paused'", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    const socket = last();
    connection.setHidden(true);
    expect(socket.closed).toBe(true);
    expect(store.getStatus()).toBe("paused");
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("reconnects at once when the tab returns", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    connection.setHidden(true);
    connection.setHidden(false);
    expect(FakeSocket.all).toHaveLength(2);
    expect(store.getStatus()).toBe("connecting");
  });

  it("cancels a pending retry while hidden, and starts afresh on return", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().drop();
    connection.setHidden(true);
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.all).toHaveLength(1);
    connection.setHidden(false);
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("a tab that is hidden from the start never connects", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setHidden(true);
    connection.setWanted(true);
    expect(FakeSocket.all).toHaveLength(0);
    expect(store.getStatus()).toBe("paused");
  });

  it("gives a 'polling' tab a fresh start when it returns", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    for (let i = 0; i < 3; i++) {
      last().drop();
      vi.advanceTimersByTime(5000);
    }
    expect(store.getStatus()).toBe("polling");
    connection.setHidden(true);
    connection.setHidden(false);
    expect(store.getStatus()).toBe("connecting");
  });
});

describe("LiveConnection: the network", () => {
  it("retries at once when the network comes back, instead of finishing the wait", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().drop();
    last().readyState = 3;
    // a long wait is pending; the browser says we are online again
    connection.networkBack();
    expect(FakeSocket.all.length).toBeGreaterThanOrEqual(1);
  });

  it("does nothing if it is already connected", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    connection.networkBack();
    expect(FakeSocket.all).toHaveLength(1);
  });
});

describe("LiveConnection: cleaning up", () => {
  it("dispose() closes the socket and leaves no timers running", () => {
    const { store, connection } = setup();
    watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    last().tickers(["BTCUSDT", "1"]);
    const socket = last();
    connection.dispose();
    expect(socket.closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(300_000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("leaves no timers once nothing wants prices", () => {
    const { store, connection } = setup();
    const [off] = watch(store, "BTCUSDT");
    connection.setWanted(true);
    last().open();
    last().tickers(["BTCUSDT", "1"]);
    off();
    connection.setWanted(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a connection that was never wanted has no timers at all", () => {
    setup();
    expect(vi.getTimerCount()).toBe(0);
  });
});
