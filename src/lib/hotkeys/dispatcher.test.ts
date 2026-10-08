import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HotkeyDispatcher, type DispatcherOptions } from "./dispatcher";

function setup(options: Partial<DispatcherOptions> = {}) {
  const onPending = vi.fn();
  const dispatcher = new HotkeyDispatcher({
    isEnabled: () => true,
    isTyping: () => false,
    isDialogOpen: () => false,
    onPending,
    ...options,
  });
  const press = (init: KeyboardEventInit & { target?: EventTarget }) => {
    const event = new KeyboardEvent("keydown", {
      cancelable: true,
      bubbles: true,
      ...init,
    });
    dispatcher.handleKeyDown(event);
    return event;
  };
  return { dispatcher, onPending, press };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("HotkeyDispatcher: single keys", () => {
  it("runs the handler registered for a key and swallows the key", () => {
    const { dispatcher, press } = setup();
    const theme = vi.fn();
    dispatcher.register("theme", theme);
    const event = press({ key: "t", code: "KeyT" });
    expect(theme).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves a key alone when nothing is registered for it (1 on a page without a chart)", () => {
    const { dispatcher, press } = setup();
    dispatcher.register("theme", vi.fn());
    const event = press({ key: "1", code: "Digit1" });
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves the key alone when the handler says it did not apply", () => {
    const { dispatcher, press } = setup();
    dispatcher.register("list.open", () => false);
    const event = press({ key: "Enter", code: "Enter" });
    expect(event.defaultPrevented).toBe(false);
  });

  it("the most recently registered handler answers, and unregistering brings back the one before", () => {
    const { dispatcher, press } = setup();
    const first = vi.fn();
    const second = vi.fn();
    dispatcher.register("theme", first);
    const undo = dispatcher.register("theme", second);
    press({ key: "t", code: "KeyT" });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    undo();
    press({ key: "t", code: "KeyT" });
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("stops answering once its handler is unregistered", () => {
    const { dispatcher, press } = setup();
    const theme = vi.fn();
    const undo = dispatcher.register("theme", theme);
    undo();
    expect(press({ key: "t", code: "KeyT" }).defaultPrevented).toBe(false);
    expect(theme).not.toHaveBeenCalled();
  });

  it("works on the Russian layout (the key that types е is T)", () => {
    const { dispatcher, press } = setup();
    const theme = vi.fn();
    dispatcher.register("theme", theme);
    press({ key: "е", code: "KeyT" });
    expect(theme).toHaveBeenCalledTimes(1);
  });

  it("ignores keys held down (repeat), except where moving along a list wants them", () => {
    const { dispatcher, press } = setup();
    const theme = vi.fn();
    const next = vi.fn();
    dispatcher.register("theme", theme);
    dispatcher.register("list.next", next);
    press({ key: "t", code: "KeyT", repeat: true });
    press({ key: "j", code: "KeyJ", repeat: true });
    expect(theme).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("ignores events another handler already took, and text being composed", () => {
    const { dispatcher, press } = setup();
    const theme = vi.fn();
    dispatcher.register("theme", theme);
    const taken = new KeyboardEvent("keydown", {
      key: "t",
      code: "KeyT",
      cancelable: true,
    });
    taken.preventDefault();
    dispatcher.handleKeyDown(taken);
    press({ key: "t", code: "KeyT", isComposing: true });
    expect(theme).not.toHaveBeenCalled();
  });

  it("never takes keys that carry Ctrl, Cmd or Alt (the browser's)", () => {
    const { dispatcher, press } = setup();
    const theme = vi.fn();
    dispatcher.register("theme", theme);
    press({ key: "t", code: "KeyT", ctrlKey: true });
    press({ key: "t", code: "KeyT", metaKey: true });
    press({ key: "t", code: "KeyT", altKey: true });
    expect(theme).not.toHaveBeenCalled();
  });
});

describe("HotkeyDispatcher: when not to listen", () => {
  it("does not take keys typed into a field, but takes Ctrl+K there", () => {
    const { dispatcher, press } = setup({ isTyping: () => true });
    const theme = vi.fn();
    const palette = vi.fn();
    dispatcher.register("theme", theme);
    dispatcher.register("palette", palette);
    press({ key: "t", code: "KeyT" });
    press({ key: "k", code: "KeyK", ctrlKey: true });
    expect(theme).not.toHaveBeenCalled();
    expect(palette).toHaveBeenCalledTimes(1);
  });

  it("does not take keys while a dialog is open, except what is meant for dialogs", () => {
    const { dispatcher, press } = setup({ isDialogOpen: () => true });
    const theme = vi.fn();
    const palette = vi.fn();
    dispatcher.register("theme", theme);
    dispatcher.register("palette", palette);
    press({ key: "t", code: "KeyT" });
    press({ key: "k", code: "KeyK", metaKey: true });
    expect(theme).not.toHaveBeenCalled();
    expect(palette).toHaveBeenCalledTimes(1);
  });

  it("when switched off, takes nothing but Ctrl+K", () => {
    const { dispatcher, press } = setup({ isEnabled: () => false });
    const theme = vi.fn();
    const go = vi.fn();
    const palette = vi.fn();
    dispatcher.register("theme", theme);
    dispatcher.register("go.markets", go);
    dispatcher.register("palette", palette);
    press({ key: "t", code: "KeyT" });
    press({ key: "g", code: "KeyG" });
    press({ key: "m", code: "KeyM" });
    press({ key: "k", code: "KeyK", ctrlKey: true });
    expect(theme).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
    expect(palette).toHaveBeenCalledTimes(1);
  });

  it("reads the switch each time: turning shortcuts back on works at once", () => {
    let enabled = false;
    const { dispatcher, press } = setup({ isEnabled: () => enabled });
    const theme = vi.fn();
    dispatcher.register("theme", theme);
    press({ key: "t", code: "KeyT" });
    enabled = true;
    press({ key: "t", code: "KeyT" });
    expect(theme).toHaveBeenCalledTimes(1);
  });
});

describe("HotkeyDispatcher: sequences (g then h)", () => {
  it("runs the sequence's handler on its second key, and reports what is pending", () => {
    const { dispatcher, onPending, press } = setup();
    const markets = vi.fn();
    dispatcher.register("go.markets", markets);

    const first = press({ key: "g", code: "KeyG" });
    expect(first.defaultPrevented).toBe(true);
    expect(markets).not.toHaveBeenCalled();
    expect(onPending).toHaveBeenLastCalledWith(["g"]);

    press({ key: "m", code: "KeyM" });
    expect(markets).toHaveBeenCalledTimes(1);
    expect(onPending).toHaveBeenLastCalledWith(null);
  });

  it("picks the right destination for each second key", () => {
    const { dispatcher, press } = setup();
    const calls: string[] = [];
    dispatcher.register("go.home", () => void calls.push("home"));
    dispatcher.register("go.markets", () => void calls.push("markets"));
    dispatcher.register("go.watchlist", () => void calls.push("watchlist"));
    dispatcher.register("go.compare", () => void calls.push("compare"));
    for (const [second, code] of [
      ["h", "KeyH"],
      ["m", "KeyM"],
      ["w", "KeyW"],
      ["c", "KeyC"],
    ] as const) {
      press({ key: "g", code: "KeyG" });
      press({ key: second, code });
    }
    expect(calls).toEqual(["home", "markets", "watchlist", "compare"]);
  });

  it("gives up when the second key does not come in time, and then g is nothing", () => {
    const { dispatcher, onPending, press } = setup();
    const markets = vi.fn();
    dispatcher.register("go.markets", markets);
    press({ key: "g", code: "KeyG" });
    vi.advanceTimersByTime(1100);
    expect(onPending).toHaveBeenLastCalledWith(null);
    press({ key: "m", code: "KeyM" });
    expect(markets).not.toHaveBeenCalled();
  });

  it("still waits at 900ms", () => {
    const { dispatcher, press } = setup();
    const markets = vi.fn();
    dispatcher.register("go.markets", markets);
    press({ key: "g", code: "KeyG" });
    vi.advanceTimersByTime(900);
    press({ key: "m", code: "KeyM" });
    expect(markets).toHaveBeenCalledTimes(1);
  });

  it("a wrong second key cancels the sequence and is then read as a key of its own", () => {
    const { dispatcher, press } = setup();
    const theme = vi.fn();
    const markets = vi.fn();
    dispatcher.register("theme", theme);
    dispatcher.register("go.markets", markets);
    press({ key: "g", code: "KeyG" });
    const event = press({ key: "t", code: "KeyT" });
    expect(theme).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    press({ key: "m", code: "KeyM" });
    expect(markets).not.toHaveBeenCalled();
  });

  it("a lone modifier press does not cancel the wait (Shift on the way to a key)", () => {
    const { dispatcher, press } = setup();
    const markets = vi.fn();
    dispatcher.register("go.markets", markets);
    press({ key: "g", code: "KeyG" });
    press({ key: "Shift", code: "ShiftLeft", shiftKey: true });
    press({ key: "m", code: "KeyM" });
    expect(markets).toHaveBeenCalledTimes(1);
  });

  it("does not start a sequence nobody is waiting for (no destination registered)", () => {
    const { dispatcher, press } = setup();
    dispatcher.register("theme", vi.fn());
    expect(press({ key: "g", code: "KeyG" }).defaultPrevented).toBe(false);
  });

  it("does not start while typing, or run a second key typed into a field", () => {
    let typing = false;
    const { dispatcher, press } = setup({ isTyping: () => typing });
    const markets = vi.fn();
    dispatcher.register("go.markets", markets);
    typing = true;
    press({ key: "g", code: "KeyG" });
    press({ key: "m", code: "KeyM" });
    expect(markets).not.toHaveBeenCalled();

    typing = false;
    press({ key: "g", code: "KeyG" });
    typing = true; // focus moved into a field between the two keys
    press({ key: "m", code: "KeyM" });
    expect(markets).not.toHaveBeenCalled();
  });

  it("reset() drops a half-typed sequence", () => {
    const { dispatcher, onPending, press } = setup();
    const markets = vi.fn();
    dispatcher.register("go.markets", markets);
    press({ key: "g", code: "KeyG" });
    dispatcher.reset();
    expect(onPending).toHaveBeenLastCalledWith(null);
    press({ key: "m", code: "KeyM" });
    expect(markets).not.toHaveBeenCalled();
  });

  it("dispose() forgets handlers and any pending sequence", () => {
    const { dispatcher, press } = setup();
    const theme = vi.fn();
    dispatcher.register("theme", theme);
    dispatcher.dispose();
    press({ key: "t", code: "KeyT" });
    expect(theme).not.toHaveBeenCalled();
  });
});
