import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  getSubject,
  setSubject,
  useSubject,
  useSubjectId,
  type Subject,
} from "./shared-subject";

const btc: Subject = {
  id: "bitcoin",
  name: "Bitcoin",
  symbol: "BTC",
  image: null,
  price: 80000,
};
const eth: Subject = {
  id: "ethereum",
  name: "Ethereum",
  symbol: "ETH",
  image: null,
  price: 2400,
};

afterEach(() => act(() => setSubject(null)));

describe("shared subject", () => {
  it("starts empty and holds the coin that was set", () => {
    expect(getSubject()).toBeNull();
    act(() => setSubject(btc));
    expect(getSubject()).toEqual(btc);
  });

  it("useSubject follows it", () => {
    const { result } = renderHook(() => useSubject());
    expect(result.current).toBeNull();
    act(() => setSubject(eth));
    expect(result.current).toEqual(eth);
  });

  it("useSubjectId re-renders only when the coin itself changes, not its price", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useSubjectId();
    });
    act(() => setSubject(btc));
    expect(result.current).toBe("bitcoin");
    const before = renders;
    act(() => setSubject({ ...btc, price: 81000 }));
    expect(renders).toBe(before);
    act(() => setSubject(eth));
    expect(result.current).toBe("ethereum");
  });

  it("ignores setting the very same coin and price again", () => {
    let notified = 0;
    const { result } = renderHook(() => useSubject());
    act(() => setSubject(btc));
    const first = result.current;
    notified++;
    act(() => setSubject({ ...btc }));
    expect(result.current).toBe(first);
    expect(notified).toBe(1);
  });
});
