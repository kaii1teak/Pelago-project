import type { Kline, LiveStatus, Tick } from "./types";

type Listener = () => void;

/**
 * What the live feed has said, keyed by Binance symbol ("BTCUSDT"). Components subscribe to
 * ONE symbol, so a tick re-renders only what shows that symbol, never the whole table; and
 * a symbol nobody is watching is not even stored. Plain objects and no React here: it is
 * the thing the connection writes to and `useSyncExternalStore` reads from.
 */
export class LiveStore {
  private ticks = new Map<string, Tick>();
  private klines = new Map<string, Kline>();
  private tickListeners = new Map<string, Set<Listener>>();
  private klineListeners = new Map<string, Set<Listener>>();
  private statusListeners = new Set<Listener>();
  private demandListeners = new Set<(subscribers: number) => void>();
  private status: LiveStatus = "idle";
  private subscribers = 0;

  /* ---- reading --------------------------------------------------------- */

  getTick = (symbol: string) => this.ticks.get(symbol) ?? null;
  getKline = (symbol: string) => this.klines.get(symbol) ?? null;
  getStatus = () => this.status;

  /** Whether anything on screen is showing this symbol. */
  isWatched = (symbol: string) => (this.tickListeners.get(symbol)?.size ?? 0) > 0;

  /* ---- subscribing ----------------------------------------------------- */

  subscribeTick = (symbol: string, listener: Listener) =>
    this.add(this.tickListeners, symbol, listener);
  subscribeKline = (symbol: string, listener: Listener) =>
    this.add(this.klineListeners, symbol, listener);

  subscribeStatus = (listener: Listener) => {
    this.statusListeners.add(listener);
    return () => void this.statusListeners.delete(listener);
  };

  /** Told how many symbol subscriptions exist, each time it changes: the connection opens for the first and closes after the last. */
  onDemand = (listener: (subscribers: number) => void) => {
    this.demandListeners.add(listener);
    return () => void this.demandListeners.delete(listener);
  };

  private add(
    map: Map<string, Set<Listener>>,
    symbol: string,
    listener: Listener,
  ): () => void {
    let set = map.get(symbol);
    if (!set) map.set(symbol, (set = new Set()));
    set.add(listener);
    this.setSubscribers(this.subscribers + 1);
    return () => {
      const current = map.get(symbol);
      if (!current?.delete(listener)) return;
      if (current.size === 0) map.delete(symbol);
      this.setSubscribers(this.subscribers - 1);
    };
  }

  private setSubscribers(count: number) {
    this.subscribers = count;
    for (const listener of this.demandListeners) listener(count);
  }

  /* ---- writing (the connection) ---------------------------------------- */

  /** Stores a batch and tells only the symbols whose price actually moved. */
  applyTicks(batch: ReadonlyMap<string, Tick>) {
    for (const [symbol, tick] of batch) {
      const before = this.ticks.get(symbol);
      if (before && before.price === tick.price) {
        this.ticks.set(symbol, tick); // newer time, same price: nothing to redraw
        continue;
      }
      this.ticks.set(symbol, tick);
      this.notify(this.tickListeners, symbol);
    }
  }

  applyKlines(batch: ReadonlyMap<string, Kline>) {
    for (const [symbol, kline] of batch) {
      this.klines.set(symbol, kline);
      this.notify(this.klineListeners, symbol);
    }
  }

  setStatus(status: LiveStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener();
  }

  /** Forget prices (the connection is gone and what is stored is going stale). Subscriptions stay. */
  clearData() {
    this.ticks.clear();
    this.klines.clear();
  }

  private notify(map: Map<string, Set<Listener>>, symbol: string) {
    const set = map.get(symbol);
    if (set) for (const listener of [...set]) listener();
  }
}
