import { describe, expect, it } from "vitest";
import { TICKER_STREAM, klineStream, parseMessage } from "./messages";

const ticker = (s: string, c: string, E = 1000) => ({ e: "24hrMiniTicker", s, c, E });
const kline = (s: string, k: Record<string, unknown>) => ({ e: "kline", s, k });

describe("parseMessage: tickers", () => {
  it("reads the array of mini tickers a combined stream sends, wrapped", () => {
    const m = parseMessage(
      JSON.stringify({
        stream: TICKER_STREAM,
        data: [
          ticker("BTCUSDT", "81758.91000000", 1791489586017),
          ticker("ETHUSDT", "2464.35"),
        ],
      }),
    );
    expect(m).toEqual({
      type: "tickers",
      ticks: new Map([
        ["BTCUSDT", { price: 81758.91, time: 1791489586017 }],
        ["ETHUSDT", { price: 2464.35, time: 1000 }],
      ]),
    });
  });

  it("reads the same array bare (a raw stream)", () => {
    const m = parseMessage(JSON.stringify([ticker("SOLUSDT", "110.5")]));
    expect(m).toMatchObject({ type: "tickers" });
    expect(m?.type === "tickers" && m.ticks.get("SOLUSDT")?.price).toBe(110.5);
  });

  it("keeps only the dollar pairs", () => {
    const m = parseMessage(
      JSON.stringify([
        ticker("BTCEUR", "70000"),
        ticker("ETHBTC", "0.03"),
        ticker("BNBUSDT", "700"),
      ]),
    );
    expect(m?.type === "tickers" && [...m.ticks.keys()]).toEqual(["BNBUSDT"]);
  });

  it("drops entries with no usable price, and a frame left with none is nothing", () => {
    expect(
      parseMessage(JSON.stringify([ticker("BTCUSDT", "0"), ticker("ETHUSDT", "abc")])),
    ).toBeNull();
    expect(parseMessage(JSON.stringify([ticker("BTCUSDT", "")]))).toBeNull();
    expect(parseMessage(JSON.stringify([null, 5, "x", { s: 1 }]))).toBeNull();
  });
});

describe("parseMessage: candles", () => {
  const k = { t: 1700000000000, o: "100", h: "110", l: "95", c: "105", i: "1m" };

  it("reads a 1-minute candle, wrapped or bare", () => {
    const expected = {
      type: "kline",
      symbol: "BTCUSDT",
      kline: { openTime: 1700000000000, open: 100, high: 110, low: 95, close: 105 },
    };
    expect(
      parseMessage(
        JSON.stringify({ stream: "btcusdt@kline_1m", data: kline("BTCUSDT", k) }),
      ),
    ).toEqual(expected);
    expect(parseMessage(JSON.stringify(kline("BTCUSDT", k)))).toEqual(expected);
  });

  it("ignores a candle with a missing or bad number, and one that isn't a dollar pair", () => {
    expect(parseMessage(JSON.stringify(kline("BTCUSDT", { ...k, h: "x" })))).toBeNull();
    expect(parseMessage(JSON.stringify(kline("BTCUSDT", { o: "1" })))).toBeNull();
    expect(parseMessage(JSON.stringify(kline("ETHBTC", k)))).toBeNull();
    expect(parseMessage(JSON.stringify({ e: "kline", s: "BTCUSDT" }))).toBeNull();
  });
});

describe("parseMessage: everything else", () => {
  it("is nothing for acknowledgements, junk and non-text frames", () => {
    expect(parseMessage(JSON.stringify({ result: null, id: 1 }))).toBeNull();
    expect(parseMessage("not json")).toBeNull();
    expect(parseMessage("")).toBeNull();
    expect(parseMessage(JSON.stringify("hello"))).toBeNull();
    expect(parseMessage(JSON.stringify(null))).toBeNull();
    expect(parseMessage(new ArrayBuffer(8))).toBeNull();
    expect(parseMessage(undefined)).toBeNull();
  });
});

describe("stream names", () => {
  it("names the candle stream in lower case, as Binance wants", () => {
    expect(klineStream("BTCUSDT")).toBe("btcusdt@kline_1m");
    expect(TICKER_STREAM).toBe("!miniTicker@arr");
  });
});
