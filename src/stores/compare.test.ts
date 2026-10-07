import { beforeEach, describe, expect, it } from "vitest";
import { MAX_COMPARE } from "@/lib/compare";
import { COMPARE_STORAGE_KEY, useCompareStore } from "./compare";

const store = useCompareStore;
const saved = () => JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY)!).state.ids;

beforeEach(() => {
  localStorage.clear();
  store.setState({ ids: [] });
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
