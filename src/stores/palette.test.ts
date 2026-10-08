import { beforeEach, describe, expect, it } from "vitest";
import { usePaletteStore } from "./palette";

beforeEach(() => usePaletteStore.setState({ open: false }));

describe("palette store", () => {
  it("starts closed", () => {
    expect(usePaletteStore.getState().open).toBe(false);
  });

  it("opens, closes and toggles", () => {
    usePaletteStore.getState().setOpen(true);
    expect(usePaletteStore.getState().open).toBe(true);
    usePaletteStore.getState().toggle();
    expect(usePaletteStore.getState().open).toBe(false);
    usePaletteStore.getState().toggle();
    expect(usePaletteStore.getState().open).toBe(true);
  });

  it("is never persisted: it always starts closed", () => {
    usePaletteStore.getState().setOpen(true);
    expect(localStorage.length).toBe(0);
  });

  it("remembers what had focus when it opened, so it can be handed back", () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    usePaletteStore.getState().setOpen(true);
    expect(usePaletteStore.getState().opener).toBe(button);
    button.remove();
  });

  it("does not remember the page itself as an opener", () => {
    (document.activeElement as HTMLElement | null)?.blur();
    usePaletteStore.getState().toggle();
    expect(usePaletteStore.getState().opener).toBeNull();
  });

  it("keeps the first opener while it stays open", () => {
    const a = document.createElement("button");
    const b = document.createElement("button");
    document.body.append(a, b);
    a.focus();
    usePaletteStore.getState().setOpen(true);
    b.focus(); // focus moves around inside the palette
    usePaletteStore.getState().setOpen(true);
    expect(usePaletteStore.getState().opener).toBe(a);
    a.remove();
    b.remove();
  });
});
