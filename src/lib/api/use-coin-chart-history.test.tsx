import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { maxBack } from "@/lib/chart";
import { makeTestClient } from "@/test/render";
import { useCoinChartHistory } from "./hooks";

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

/** Each step back is a block of 3 hourly points, `10_000 * n` earlier than the one before. */
const block = (back: number) =>
  [0, 1, 2].map((i) => ({
    time: 1_000_000 - back * 10_000 + i * 3600,
    value: back * 100 + i,
  }));

type Plan = (back: number, range: string) => "ok" | "fail" | "pending";
function api(plan: Plan = () => "ok") {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input), "http://test");
    const back = Number(url.searchParams.get("back") ?? 0);
    const result = plan(back, url.searchParams.get("range") ?? "");
    if (result === "pending") return new Promise<Response>(() => {});
    if (result === "fail") {
      return new Response(
        JSON.stringify({ error: { code: "upstream_error", message: "x" } }),
        {
          status: 502,
        },
      );
    }
    return new Response(JSON.stringify(block(back)));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const backs = (mock: ReturnType<typeof api>) =>
  mock.mock.calls.map(([u]) =>
    Number(new URL(String(u), "http://test").searchParams.get("back") ?? 0),
  );

function setup(range: "24h" | "7d" | "30d" | "1y" = "7d", enabled = true) {
  const client = makeTestClient();
  return renderHook(({ id, range, enabled }) => useCoinChartHistory(id, range, enabled), {
    wrapper: wrapper(client),
    initialProps: { id: "bitcoin", range, enabled },
  });
}
const loaded = (result: ReturnType<typeof setup>["result"]) =>
  result.current.data?.length;

afterEach(() => vi.unstubAllGlobals());

describe("useCoinChartHistory", () => {
  it("starts with the chart's own window, and says there is more to scroll back to", async () => {
    const fetchMock = api();
    const { result } = setup();
    await waitFor(() => expect(loaded(result)).toBe(3));
    expect(backs(fetchMock)).toEqual([0]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.loadingOlder).toBe(false);
    expect(result.current.base.data).toHaveLength(3);
  });

  it("loads one older stretch on request and joins it, oldest first", async () => {
    const fetchMock = api();
    const { result } = setup();
    await waitFor(() => expect(loaded(result)).toBe(3));

    act(() => result.current.loadOlder());
    await waitFor(() => expect(loaded(result)).toBe(6));
    expect(backs(fetchMock)).toEqual([0, 1]);
    const times = result.current.data!.map((p) => p.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // The window the timeframe describes is untouched by older data.
    expect(result.current.base.data).toHaveLength(3);
  });

  it("asks for one stretch at a time, however often it is nudged while loading", async () => {
    const fetchMock = api((back) => (back === 1 ? "pending" : "ok"));
    const { result } = setup();
    await waitFor(() => expect(loaded(result)).toBe(3));

    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.loadingOlder).toBe(true));
    act(() => {
      result.current.loadOlder();
      result.current.loadOlder();
      result.current.loadOlder();
    });
    expect(backs(fetchMock)).toEqual([0, 1]);
  });

  it("keeps stepping back, one stretch per request", async () => {
    const fetchMock = api();
    const { result } = setup();
    await waitFor(() => expect(loaded(result)).toBe(3));
    for (let step = 1; step <= 3; step++) {
      act(() => result.current.loadOlder());
      await waitFor(() => expect(loaded(result)).toBe(3 + step * 3));
    }
    expect(backs(fetchMock)).toEqual([0, 1, 2, 3]);
  });

  it("stops when the history runs out", async () => {
    const fetchMock = api();
    const { result } = setup("30d");
    await waitFor(() => expect(loaded(result)).toBe(3));
    const limit = maxBack("30d");
    for (let i = 0; i < limit + 3; i++) {
      act(() => result.current.loadOlder());
      await waitFor(() => expect(result.current.loadingOlder).toBe(false));
    }
    expect(Math.max(...backs(fetchMock))).toBe(limit);
    expect(backs(fetchMock)).toHaveLength(limit + 1);
    expect(result.current.hasMore).toBe(false);
  });

  it("goes back to the latest window on reset", async () => {
    api();
    const { result } = setup();
    await waitFor(() => expect(loaded(result)).toBe(3));
    act(() => result.current.loadOlder());
    await waitFor(() => expect(loaded(result)).toBe(6));

    act(() => result.current.reset());
    await waitFor(() => expect(loaded(result)).toBe(3));
    expect(result.current.hasMore).toBe(true);
  });

  it("starts again from the latest window when the timeframe changes", async () => {
    const fetchMock = api();
    const { result, rerender } = setup("7d");
    await waitFor(() => expect(loaded(result)).toBe(3));
    act(() => result.current.loadOlder());
    await waitFor(() => expect(loaded(result)).toBe(6));

    rerender({ id: "bitcoin", range: "30d", enabled: true });
    await waitFor(() => expect(result.current.base.isPlaceholderData).toBe(false));
    expect(loaded(result)).toBe(3);
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes("range=30d&back=")),
    ).toBe(false);
  });

  it("starts again from the latest window for another coin", async () => {
    api();
    const { result, rerender } = setup();
    await waitFor(() => expect(loaded(result)).toBe(3));
    act(() => result.current.loadOlder());
    await waitFor(() => expect(loaded(result)).toBe(6));

    rerender({ id: "ethereum", range: "7d", enabled: true });
    await waitFor(() => expect(loaded(result)).toBe(3));
  });

  it("reports a stretch that failed, stops asking for more, and can retry that one", async () => {
    let failing = true;
    const fetchMock = api((back) => (back === 1 && failing ? "fail" : "ok"));
    const { result } = setup();
    await waitFor(() => expect(loaded(result)).toBe(3));

    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.olderError).not.toBeNull());
    expect(loaded(result)).toBe(3); // what was there stays on screen

    act(() => result.current.loadOlder());
    expect(backs(fetchMock)).toEqual([0, 1]); // no piling on while it is failing

    failing = false;
    act(() => void result.current.olderError!.retry());
    await waitFor(() => expect(loaded(result)).toBe(6));
    expect(result.current.olderError).toBeNull();
  });

  it("does nothing while disabled (candles have no older history to load)", async () => {
    const fetchMock = api();
    const { result } = setup("7d", false);
    act(() => result.current.loadOlder());
    expect(result.current.hasMore).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never offers older history for 1y: it already holds all there is", async () => {
    api();
    const { result } = setup("1y");
    await waitFor(() => expect(loaded(result)).toBe(3));
    expect(result.current.hasMore).toBe(false);
  });
});
