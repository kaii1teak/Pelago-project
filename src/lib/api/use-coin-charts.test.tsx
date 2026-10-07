import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeTestClient } from "@/test/render";
import { useCoinCharts } from "./hooks";

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

afterEach(() => vi.unstubAllGlobals());

describe("useCoinCharts", () => {
  it("returns one result per coin, in the order asked, requesting each coin's own chart", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const id = String(input).split("/")[3]!;
      return new Response(
        JSON.stringify([{ time: 1, value: id === "bitcoin" ? 10 : 20 }]),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCoinCharts(["ethereum", "bitcoin"], "30d"), {
      wrapper: wrapper(makeTestClient()),
    });

    await waitFor(() => expect(result.current.every((r) => r.data)).toBe(true));
    expect(result.current.map((r) => r.data![0]!.value)).toEqual([20, 10]);
    expect(fetchMock.mock.calls.map(([url]) => String(url)).sort()).toEqual([
      "/api/coins/bitcoin/chart?range=30d",
      "/api/coins/ethereum/chart?range=30d",
    ]);
  });

  it("one failing coin does not blank the others", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) =>
        String(input).includes("/bitcoin/")
          ? new Response(JSON.stringify([{ time: 1, value: 1 }]))
          : new Response(JSON.stringify({ error: { code: "not_found", message: "x" } }), {
              status: 404,
            }),
      ),
    );
    const { result } = renderHook(() => useCoinCharts(["bitcoin", "nope"], "7d"), {
      wrapper: wrapper(makeTestClient()),
    });

    await waitFor(() => expect(result.current.every((r) => !r.isPending)).toBe(true));
    expect(result.current[0]!.data).toEqual([{ time: 1, value: 1 }]);
    expect(result.current[1]!.isError).toBe(true);
    expect(result.current[1]!.data).toBeUndefined();
  });

  it("makes no requests for no coins", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCoinCharts([], "7d"), {
      wrapper: wrapper(makeTestClient()),
    });
    expect(result.current).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
