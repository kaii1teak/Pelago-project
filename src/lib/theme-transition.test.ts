import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseDuration, runThemeChange } from "./theme-transition";

const root = document.documentElement;

function reducedMotion(on: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: on && query.includes("reduce") })),
  );
}

/** A View Transitions API double: runs the callback at once, finishes when told to. */
function fakeViewTransitions() {
  let finish: () => void = () => {};
  const start = vi.fn((callback: () => void) => {
    callback();
    const finished = new Promise<void>((resolve) => (finish = resolve));
    return { ready: Promise.resolve(), finished } as unknown as ViewTransition;
  });
  Object.defineProperty(document, "startViewTransition", {
    value: start,
    configurable: true,
  });
  const animate = vi.fn();
  root.animate = animate as unknown as typeof root.animate;
  return { start, animate, finish: () => finish() };
}

beforeEach(() => {
  delete root.dataset.vt;
  root.removeAttribute("style");
  reducedMotion(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(document, "startViewTransition");
  Reflect.deleteProperty(root, "animate");
});

describe("parseDuration", () => {
  it("reads milliseconds and seconds, with or without spaces around", () => {
    expect(parseDuration("500ms")).toBe(500);
    expect(parseDuration(" 800ms ")).toBe(800);
    expect(parseDuration("0.8s")).toBe(800);
    expect(parseDuration("1.5s")).toBe(1500);
    expect(parseDuration("2s")).toBe(2000);
    expect(parseDuration("0ms")).toBe(0);
  });

  it("falls back to half a second for anything it can't read", () => {
    for (const bad of ["", "fast", "var(--x)", "500", "ms"]) {
      expect(parseDuration(bad), JSON.stringify(bad)).toBe(500);
    }
  });
});

describe("runThemeChange without the View Transitions API", () => {
  it("applies the change right away and fades colors for a moment", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    runThemeChange(apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(root.dataset.vt).toBe("theme-blend");
    vi.advanceTimersByTime(400);
    expect(root.dataset.vt).toBe("theme-blend"); // still fading: it lasts half a second
    vi.advanceTimersByTime(300);
    expect(root.dataset.vt).toBeUndefined();
  });

  it("waits as long as --theme-duration says", () => {
    vi.useFakeTimers();
    root.style.setProperty("--theme-duration", "2s");
    runThemeChange(vi.fn());
    vi.advanceTimersByTime(1500);
    expect(root.dataset.vt).toBe("theme-blend");
    vi.advanceTimersByTime(700);
    expect(root.dataset.vt).toBeUndefined();
  });

  it("changes instantly under reduced motion", () => {
    reducedMotion(true);
    const apply = vi.fn();
    runThemeChange(apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(root.dataset.vt).toBeUndefined();
  });
});

describe("runThemeChange with the View Transitions API", () => {
  it("runs the change inside a transition, and that's all it does: the animation is CSS", async () => {
    const { start, animate } = fakeViewTransitions();
    const apply = vi.fn();
    runThemeChange(apply);
    expect(start).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(root.dataset.vt).toBe("theme");
    await Promise.resolve();
    await Promise.resolve();
    expect(animate).not.toHaveBeenCalled();
    expect(root.getAttribute("style") ?? "").toBe("");
  });

  it("clears its mark when the transition is over", async () => {
    const { finish } = fakeViewTransitions();
    runThemeChange(vi.fn());
    expect(root.dataset.vt).toBe("theme");
    finish();
    await vi.waitFor(() => expect(root.dataset.vt).toBeUndefined());
  });

  it("is the same crossfade under reduced motion: opacity only, nothing moves", () => {
    reducedMotion(true);
    const { start } = fakeViewTransitions();
    runThemeChange(vi.fn());
    expect(start).toHaveBeenCalledTimes(1);
    expect(root.dataset.vt).toBe("theme");
  });

  it("applies a change that arrives mid-transition without stacking another one", () => {
    const { start } = fakeViewTransitions();
    const first = vi.fn();
    const second = vi.fn();
    runThemeChange(first);
    runThemeChange(second);
    expect(start).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("the two settings in globals.css", () => {
  const css = readFileSync(
    path.resolve(import.meta.dirname, "../app/globals.css"),
    "utf8",
  );

  it("has --theme-duration and --theme-ease, where they are meant to be changed", () => {
    expect(css).toMatch(/--theme-duration:\s*[^;]+;/);
    expect(css).toMatch(/--theme-ease:\s*[^;]+;/);
  });

  it("take their values from the motion scale (or a plain time), and an easing", () => {
    expect(css).toMatch(
      /--theme-duration:\s*(var\(--duration-(fast|base|slow|slower)\)|\d*\.?\d+m?s);/,
    );
    expect(css).toMatch(
      /--theme-ease:\s*(ease|ease-in|ease-out|ease-in-out|linear|cubic-bezier\([^)]*\));/,
    );
  });

  it("each ends where it should: neither swallows the setting that follows it (a missing ; once did)", () => {
    const duration = css.match(/--theme-duration:([^;]*);/)![1]!;
    const ease = css.match(/--theme-ease:([^;]*);/)![1]!;
    for (const value of [duration, ease]) {
      // A swallowed declaration brings a ":" (and the comment before it) into the value.
      expect(value).not.toMatch(/:|\/\*/);
    }
    expect(css).toMatch(/\n\s*--glass-blur:\s*\d+px;/);
  });

  it("the crossfade of the page uses both", () => {
    const rule = css.slice(
      css.indexOf('html[data-vt="theme"]::view-transition-old(root)'),
    );
    expect(rule).toMatch(/animation-duration:\s*var\(--theme-duration\)/);
    expect(rule).toMatch(/animation-timing-function:\s*var\(--theme-ease\)/);
  });

  it("the fallback for browsers without the API uses both too", () => {
    const rule = css.slice(css.indexOf('html[data-vt="theme-blend"] *,'));
    expect(rule).toMatch(/color var\(--theme-duration\) var\(--theme-ease\)/);
  });

  it("the header takes part in the crossfade instead of staying put", () => {
    expect(css).toMatch(
      /html\[data-vt="theme"\] \[data-vt-header\]\s*\{\s*view-transition-name:\s*none\s*!important;/,
    );
  });

  it("nothing is left of the spots", () => {
    expect(css).not.toMatch(/--theme-r\d|--bx\d|@property --theme-t/);
  });
});
