import { describe, expect, it, vi } from "vitest";
import { LiveStore } from "./store";

const tick = (price: number, time = 1) => ({ price, time });
const batch = (entries: [string, number][]) =>
  new Map(entries.map(([symbol, price]) => [symbol, tick(price)]));

describe("LiveStore: per-symbol updates", () => {
  it("tells only the symbol that changed", () => {
    const store = new LiveStore();
    const btc = vi.fn();
    const eth = vi.fn();
    store.subscribeTick("BTCUSDT", btc);
    store.subscribeTick("ETHUSDT", eth);
    store.applyTicks(batch([["BTCUSDT", 80000]]));
    expect(btc).toHaveBeenCalledTimes(1);
    expect(eth).not.toHaveBeenCalled();
    expect(store.getTick("BTCUSDT")).toEqual(tick(80000));
    expect(store.getTick("ETHUSDT")).toBeNull();
  });

  it("does not tell anyone when the price is the same as before", () => {
    const store = new LiveStore();
    const listener = vi.fn();
    store.subscribeTick("BTCUSDT", listener);
    store.applyTicks(batch([["BTCUSDT", 80000]]));
    store.applyTicks(new Map([["BTCUSDT", tick(80000, 2)]]));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getTick("BTCUSDT")?.time).toBe(2); // but the newer time is kept
  });

  it("tells every subscriber of the symbol, and stops when one leaves", () => {
    const store = new LiveStore();
    const a = vi.fn();
    const b = vi.fn();
    const offA = store.subscribeTick("BTCUSDT", a);
    store.subscribeTick("BTCUSDT", b);
    store.applyTicks(batch([["BTCUSDT", 1]]));
    offA();
    store.applyTicks(batch([["BTCUSDT", 2]]));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it("returns the same object until something changes (what useSyncExternalStore needs)", () => {
    const store = new LiveStore();
    store.applyTicks(batch([["BTCUSDT", 1]]));
    expect(store.getTick("BTCUSDT")).toBe(store.getTick("BTCUSDT"));
  });
});

describe("LiveStore: who is watching", () => {
  it("knows which symbols are watched", () => {
    const store = new LiveStore();
    expect(store.isWatched("BTCUSDT")).toBe(false);
    const off = store.subscribeTick("BTCUSDT", () => {});
    expect(store.isWatched("BTCUSDT")).toBe(true);
    off();
    expect(store.isWatched("BTCUSDT")).toBe(false);
  });

  it("reports how many subscriptions there are, so the connection can open and close", () => {
    const store = new LiveStore();
    const demand = vi.fn();
    store.onDemand(demand);
    const off1 = store.subscribeTick("A", () => {});
    const off2 = store.subscribeTick("B", () => {});
    const off3 = store.subscribeKline("A", () => {});
    off1();
    off2();
    off3();
    expect(demand.mock.calls.map(([n]) => n)).toEqual([1, 2, 3, 2, 1, 0]);
  });

  it("counts a subscription once however often it is cancelled", () => {
    const store = new LiveStore();
    const demand = vi.fn();
    store.onDemand(demand);
    const off = store.subscribeTick("A", () => {});
    off();
    off();
    expect(demand.mock.calls.map(([n]) => n)).toEqual([1, 0]);
  });
});

describe("LiveStore: candles, status and clearing", () => {
  it("stores and announces candles", () => {
    const store = new LiveStore();
    const listener = vi.fn();
    store.subscribeKline("BTCUSDT", listener);
    const k = { openTime: 1, open: 1, high: 2, low: 0.5, close: 1.5 };
    store.applyKlines(new Map([["BTCUSDT", k]]));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getKline("BTCUSDT")).toBe(k);
  });

  it("announces a status only when it changes", () => {
    const store = new LiveStore();
    const listener = vi.fn();
    store.subscribeStatus(listener);
    expect(store.getStatus()).toBe("idle");
    store.setStatus("live");
    store.setStatus("live");
    store.setStatus("paused");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getStatus()).toBe("paused");
  });

  it("forgets prices but keeps subscriptions", () => {
    const store = new LiveStore();
    store.subscribeTick("BTCUSDT", () => {});
    store.applyTicks(batch([["BTCUSDT", 1]]));
    store.clearData();
    expect(store.getTick("BTCUSDT")).toBeNull();
    expect(store.isWatched("BTCUSDT")).toBe(true);
  });
});
