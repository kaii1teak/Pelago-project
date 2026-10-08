import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HOTKEYS_STORAGE_KEY, useHotkeysStore } from "./hotkeys";

beforeEach(() => {
  localStorage.clear();
  useHotkeysStore.setState({
    enabled: true,
    pending: null,
    overlayOpen: false,
    opener: null,
  });
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("useHotkeysStore: the on/off switch", () => {
  it("is on by default", () => {
    expect(useHotkeysStore.getState().enabled).toBe(true);
  });

  it("is saved when it changes", () => {
    useHotkeysStore.getState().setEnabled(false);
    expect(JSON.parse(localStorage.getItem(HOTKEYS_STORAGE_KEY)!).state).toEqual({
      enabled: false,
    });
  });

  it("is read back from what was saved", async () => {
    localStorage.setItem(
      HOTKEYS_STORAGE_KEY,
      JSON.stringify({ state: { enabled: false }, version: 1 }),
    );
    await useHotkeysStore.persist.rehydrate();
    expect(useHotkeysStore.getState().enabled).toBe(false);
  });

  it("ignores saved junk: only a real boolean counts", async () => {
    for (const bad of ["no", 0, null, { yes: true }]) {
      useHotkeysStore.setState({ enabled: true });
      localStorage.setItem(
        HOTKEYS_STORAGE_KEY,
        JSON.stringify({ state: { enabled: bad }, version: 1 }),
      );
      await useHotkeysStore.persist.rehydrate();
      expect(useHotkeysStore.getState().enabled, JSON.stringify(bad)).toBe(true);
    }
  });

  it("does not save what is not a setting (the overlay, a half-typed sequence)", () => {
    useHotkeysStore.getState().setPending(["g"]);
    useHotkeysStore.getState().openOverlay();
    const saved = JSON.parse(localStorage.getItem(HOTKEYS_STORAGE_KEY) ?? "{}");
    expect(Object.keys(saved.state ?? {})).not.toContain("overlayOpen");
    expect(Object.keys(saved.state ?? {})).not.toContain("pending");
  });
});

describe("useHotkeysStore: the overlay", () => {
  it("remembers what had focus when it opened, to hand it back", () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    useHotkeysStore.getState().openOverlay();
    expect(useHotkeysStore.getState().overlayOpen).toBe(true);
    expect(useHotkeysStore.getState().opener).toBe(button);
  });

  it("keeps the first opener while it stays open, and after it closes", () => {
    const button = document.createElement("button");
    const other = document.createElement("button");
    document.body.append(button, other);
    button.focus();
    useHotkeysStore.getState().openOverlay();
    other.focus();
    useHotkeysStore.getState().openOverlay();
    expect(useHotkeysStore.getState().opener).toBe(button);
    useHotkeysStore.getState().setOverlayOpen(false);
    expect(useHotkeysStore.getState().opener).toBe(button);
  });

  it("has no opener when only the page had focus", () => {
    useHotkeysStore.getState().openOverlay();
    expect(useHotkeysStore.getState().opener).toBeNull();
  });
});
