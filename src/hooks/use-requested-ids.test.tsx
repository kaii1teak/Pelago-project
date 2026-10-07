import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRequestedIds } from "./use-requested-ids";

describe("useRequestedIds", () => {
  it("starts with the ids it is given", () => {
    const { result } = renderHook(() => useRequestedIds(["a", "b"]));
    expect(result.current).toEqual(["a", "b"]);
  });

  it("grows when an id is added", () => {
    const { result, rerender } = renderHook(({ ids }) => useRequestedIds(ids), {
      initialProps: { ids: ["a"] },
    });
    rerender({ ids: ["a", "b"] });
    expect(result.current).toEqual(["a", "b"]);
  });

  it("never shrinks: removing an id leaves the request unchanged (same array, no refetch)", () => {
    const { result, rerender } = renderHook(({ ids }) => useRequestedIds(ids), {
      initialProps: { ids: ["a", "b"] },
    });
    const before = result.current;
    rerender({ ids: ["a"] });
    expect(result.current).toBe(before);
    expect(result.current).toEqual(["a", "b"]);
  });

  it("does not repeat ids when one is removed and added back", () => {
    const { result, rerender } = renderHook(({ ids }) => useRequestedIds(ids), {
      initialProps: { ids: ["a", "b"] },
    });
    rerender({ ids: ["b"] });
    rerender({ ids: ["b", "a", "c"] });
    expect(result.current).toEqual(["a", "b", "c"]);
  });

  it("asks for nothing while disabled, then everything once enabled", () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useRequestedIds(["a"], enabled),
      { initialProps: { enabled: false } },
    );
    expect(result.current).toEqual([]);
    rerender({ enabled: true });
    expect(result.current).toEqual(["a"]);
  });
});
