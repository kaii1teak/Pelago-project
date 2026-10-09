import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveConnection, liveStore } from "@/lib/live/client";
import { useLiveCoin, useLiveKline, useLiveStatus, useLiveTick } from "./use-live";

const tick = (price: number) => ({ price, time: 1 });
const push = (symbol: string, price: number) =>
  act(() => liveStore.applyTicks(new Map([[symbol, tick(price)]])));

beforeEach(() => liveStore.clearData());
afterEach(() => {
  liveStore.setStatus("idle");
  vi.restoreAllMocks();
});

describe("useLiveTick", () => {
  it("is null until a price is streamed, then the latest", () => {
    const { result } = renderHook(() => useLiveTick("BTCUSDT"));
    expect(result.current).toBeNull();
    push("BTCUSDT", 80000);
    expect(result.current?.price).toBe(80000);
    push("BTCUSDT", 80100);
    expect(result.current?.price).toBe(80100);
  });

  it("re-renders only for its own symbol", () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useLiveTick("BTCUSDT");
    });
    const before = renders;
    push("ETHUSDT", 2000);
    push("SOLUSDT", 100);
    expect(renders).toBe(before);
    push("BTCUSDT", 80000);
    expect(renders).toBe(before + 1);
  });

  it("is always null for no symbol", () => {
    const { result } = renderHook(() => useLiveTick(null));
    push("BTCUSDT", 80000);
    expect(result.current).toBeNull();
  });

  it("opens the feed while something shows a price, and closes it after", () => {
    const wanted = vi.spyOn(liveConnection, "setWanted");
    const { unmount } = renderHook(() => useLiveTick("BTCUSDT"));
    expect(wanted).toHaveBeenLastCalledWith(true);
    unmount();
    expect(wanted).toHaveBeenLastCalledWith(false);
  });

  it("does not open the feed for no symbol", () => {
    const wanted = vi.spyOn(liveConnection, "setWanted");
    renderHook(() => useLiveTick(null));
    expect(wanted).not.toHaveBeenCalledWith(true);
  });

  it("keeps the feed open while any of several components shows a price", () => {
    const wanted = vi.spyOn(liveConnection, "setWanted");
    const a = renderHook(() => useLiveTick("BTCUSDT"));
    const b = renderHook(() => useLiveTick("ETHUSDT"));
    a.unmount();
    expect(wanted).not.toHaveBeenLastCalledWith(false);
    b.unmount();
    expect(wanted).toHaveBeenLastCalledWith(false);
  });
});

describe("useLiveStatus", () => {
  it("follows the feed", () => {
    const { result } = renderHook(() => useLiveStatus());
    expect(result.current).toBe("idle");
    act(() => liveStore.setStatus("live"));
    expect(result.current).toBe("live");
    act(() => liveStore.setStatus("polling"));
    expect(result.current).toBe("polling");
  });
});

describe("useLiveKline", () => {
  const candle = { openTime: 1, open: 1, high: 2, low: 0.5, close: 1.5 };

  it("asks for the candle while mounted, and lets go of it after", () => {
    const stop = vi.fn();
    const watch = vi.spyOn(liveConnection, "watchKline").mockReturnValue(stop);
    const { unmount } = renderHook(() => useLiveKline("BTCUSDT"));
    expect(watch).toHaveBeenCalledWith("BTCUSDT");
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("returns the streamed candle", () => {
    vi.spyOn(liveConnection, "watchKline").mockReturnValue(() => {});
    const { result } = renderHook(() => useLiveKline("BTCUSDT"));
    expect(result.current).toBeNull();
    act(() => liveStore.applyKlines(new Map([["BTCUSDT", candle]])));
    expect(result.current).toBe(candle);
  });

  it("asks for nothing without a symbol", () => {
    const watch = vi.spyOn(liveConnection, "watchKline");
    renderHook(() => useLiveKline(null));
    expect(watch).not.toHaveBeenCalled();
  });
});

describe("useLiveCoin", () => {
  const btc = { symbol: "BTC", rank: 1, price: 80000, change24h: 2 };

  it("is the polled price and change until a live price arrives", () => {
    const { result } = renderHook(() => useLiveCoin(btc));
    expect(result.current).toEqual({ price: 80000, change24h: 2, live: false });
  });

  it("switches to the live price, with the change measured from CoinGecko's day-ago price", () => {
    const { result } = renderHook(() => useLiveCoin(btc));
    push("BTCUSDT", 81600); // +2% on the polled price: 80000 / 1.02 = 78431 a day ago
    expect(result.current.live).toBe(true);
    expect(result.current.price).toBe(81600);
    expect(result.current.change24h).toBeCloseTo((81600 / (80000 / 1.02) - 1) * 100);
  });

  it("ignores a live price that is far from the polled one (another coin with the same ticker)", () => {
    const { result } = renderHook(() => useLiveCoin(btc));
    push("BTCUSDT", 5);
    expect(result.current).toEqual({ price: 80000, change24h: 2, live: false });
  });

  it("has no live price for a coin beyond the top 300 or a ticker that isn't one", () => {
    const small = renderHook(() =>
      useLiveCoin({ symbol: "ZZZ", rank: 900, price: 1, change24h: 0 }),
    );
    const odd = renderHook(() =>
      useLiveCoin({ symbol: "$ODD", rank: 5, price: 1, change24h: 0 }),
    );
    push("ZZZUSDT", 1);
    expect(small.result.current.live).toBe(false);
    expect(odd.result.current.live).toBe(false);
  });

  it("falls back to the polled price when the stream is lost", () => {
    const { result } = renderHook(() => useLiveCoin(btc));
    push("BTCUSDT", 81000);
    expect(result.current.live).toBe(true);
    act(() => liveStore.clearData());
    // the store forgets quietly; the next render (a poll, a status change) shows the polled price
    act(() => liveStore.applyTicks(new Map([["BTCUSDT", { price: 5, time: 2 }]])));
    expect(result.current.price).toBe(80000);
  });

  it("uses the polled price straight away when there is nothing polled to compare with", () => {
    const { result } = renderHook(() =>
      useLiveCoin({ symbol: "BTC", rank: 1, price: null }),
    );
    push("BTCUSDT", 81000);
    expect(result.current.price).toBe(81000);
  });

  it("renders the polled number on the server and the first client render alike", () => {
    function Probe() {
      return <span>{useLiveCoin(btc).price}</span>;
    }
    render(<Probe />);
    expect(screen.getByText("80000")).toBeInTheDocument();
  });
});
