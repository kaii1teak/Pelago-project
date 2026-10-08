import { beforeEach, describe, expect, it } from "vitest";
import { MAX_COMPARE } from "@/lib/compare";
import { COMPARE_STORAGE_KEY, useCompareStore } from "./compare";

const store = useCompareStore;
const saved = () => JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY)!).state.ids;

beforeEach(() => {
  localStorage.clear();
  store.setState({ ids: [], colors: {} });
});

describe("compare store", () => {
  it("adds and removes, keeping the order they were picked in", () => {
    store.getState().add("bitcoin");
    store.getState().add("ethereum");
    store.getState().add("solana");
    store.getState().remove("ethereum");
    expect(store.getState().ids).toEqual(["bitcoin", "solana"]);
  });

  it("ignores duplicates", () => {
    store.getState().add("bitcoin");
    store.getState().add("bitcoin");
    expect(store.getState().ids).toEqual(["bitcoin"]);
  });

  it(`never holds more than ${MAX_COMPARE} assets`, () => {
    for (const id of ["a", "b", "c", "d", "e"]) store.getState().add(id);
    expect(store.getState().ids).toEqual(["a", "b", "c", "d"]);
  });

  it("replaces the whole list from a link, cleaned and capped", () => {
    store.getState().add("old");
    store.getState().set(["a", "b", "a", "../bad", "c", "d", "e"]);
    expect(store.getState().ids).toEqual(["a", "b", "c", "d"]);
  });

  it("clears", () => {
    store.getState().set(["a", "b"]);
    store.getState().clear();
    expect(store.getState().ids).toEqual([]);
  });

  it("persists under a stable key", () => {
    store.getState().add("bitcoin");
    expect(saved()).toEqual(["bitcoin"]);
  });

  it("does not read storage until rehydrated (so the server markup matches)", () => {
    localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify({ state: { ids: ["bitcoin"] }, version: 1 }),
    );
    expect(store.getState().ids).toEqual([]);
  });

  it("rehydrates the saved selection on demand", async () => {
    localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify({ state: { ids: ["bitcoin", "ethereum"] }, version: 1 }),
    );
    await store.persist.rehydrate();
    expect(store.getState().ids).toEqual(["bitcoin", "ethereum"]);
    expect(store.persist.hasHydrated()).toBe(true);
  });

  it("never trusts what is in storage: bad shapes, bad ids and too many are cleaned", async () => {
    localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify({
        state: { ids: ["a", 7, null, "Bad Id", "a", "b", "c", "d", "e"] },
        version: 1,
      }),
    );
    await store.persist.rehydrate();
    expect(store.getState().ids).toEqual(["a", "b", "c", "d"]);

    localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify({ state: { ids: "not-a-list" }, version: 1 }),
    );
    await store.persist.rehydrate();
    expect(store.getState().ids).toEqual([]);
  });

  it("survives unparseable storage", async () => {
    localStorage.setItem(COMPARE_STORAGE_KEY, "{nope");
    await expect(store.persist.rehydrate()).resolves.not.toThrow();
    expect(store.getState().ids).toEqual([]);
  });
});

describe("compare store: colors", () => {
  it("gives every asset a color the moment it is added, never the same one twice", () => {
    for (const id of ["a", "b", "c", "d"]) store.getState().add(id);
    const colors = Object.values(store.getState().colors);
    expect(colors).toHaveLength(4);
    expect(new Set(colors).size).toBe(4);
  });

  it("keeps an asset's color while others are added and removed", () => {
    store.getState().add("a");
    store.getState().add("b");
    store.getState().add("c");
    const b = store.getState().colors.b;
    store.getState().remove("a");
    store.getState().add("d");
    expect(store.getState().colors.b).toBe(b);
  });

  it("forgets the color of a removed asset, so a new one can take it", () => {
    store.getState().add("a");
    const first = store.getState().colors.a;
    store.getState().remove("a");
    expect(store.getState().colors).toEqual({});
    store.getState().add("z");
    expect(store.getState().colors.z).toBe(first);
  });

  it("lets the user pick a color, and swaps with whoever had it", () => {
    store.getState().add("a");
    store.getState().add("b");
    const { a, b } = store.getState().colors;
    store.getState().setColor("a", b!);
    expect(store.getState().colors).toEqual({ a: b, b: a });
  });

  it("keeps the colors of assets that stay when a link replaces the list", () => {
    store.getState().add("a");
    store.getState().add("b");
    store.getState().setColor("b", 9);
    store.getState().set(["b", "x"]);
    expect(store.getState().colors.b).toBe(9);
    expect(Object.keys(store.getState().colors).sort()).toEqual(["b", "x"]);
  });

  it("persists the colors with the list", () => {
    store.getState().add("a");
    store.getState().setColor("a", 6);
    expect(JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY)!).state.colors).toEqual({
      a: 6,
    });
  });

  it("restores the saved colors", async () => {
    localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify({ state: { ids: ["a", "b"], colors: { a: 5, b: 2 } }, version: 1 }),
    );
    await store.persist.rehydrate();
    expect(store.getState().colors).toEqual({ a: 5, b: 2 });
  });

  it("gives colors to an older save that has none, and repairs bad ones", async () => {
    localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify({ state: { ids: ["a", "b"] }, version: 1 }),
    );
    await store.persist.rehydrate();
    expect(Object.values(store.getState().colors)).toHaveLength(2);

    localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify({
        state: { ids: ["a", "b"], colors: { a: 99, b: "red" } },
        version: 1,
      }),
    );
    await store.persist.rehydrate();
    const colors = Object.values(store.getState().colors);
    expect(colors.every((c) => Number.isInteger(c) && c >= 0 && c < 10)).toBe(true);
    expect(new Set(colors).size).toBe(2);

    localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify({ state: { ids: ["a"], colors: "nope" }, version: 1 }),
    );
    await store.persist.rehydrate();
    expect(Object.keys(store.getState().colors)).toEqual(["a"]);
  });

  it("clears the colors with the list", () => {
    store.getState().add("a");
    store.getState().clear();
    expect(store.getState().colors).toEqual({});
  });
});
