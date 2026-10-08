import { render, screen } from "@testing-library/react";
import { MotionGlobalConfig, useReducedMotion } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as MotionModule from "motion/react";
import { TweenNumber } from "./tween-number";

// motion remembers the OS setting after the first read, so tests switch it through the hook.
vi.mock("motion/react", async (original) => ({
  ...(await original<typeof MotionModule>()),
  useReducedMotion: vi.fn(() => false),
}));

const money = (n: number | null | undefined) => (n == null ? "-" : `$${Math.round(n)}`);
const text = () => screen.getByTestId("n").textContent;

function setup(value: number | null, key: string | number) {
  const view = (v: number | null, k: string | number) => (
    <p data-testid="n">
      <TweenNumber value={v} format={money} tweenKey={k} />
    </p>
  );
  const utils = render(view(value, key));
  return {
    ...utils,
    update: (v: number | null, k: string | number) => utils.rerender(view(v, k)),
  };
}

// The suite skips animations; these tests are about the counting itself (real time: it is 300ms).
beforeEach(() => {
  MotionGlobalConfig.skipAnimations = false;
  vi.mocked(useReducedMotion).mockReturnValue(false);
});
afterEach(() => {
  MotionGlobalConfig.skipAnimations = true;
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const value = () => Number(text()!.slice(1));

describe("TweenNumber", () => {
  it("starts out as the plain formatted value", () => {
    setup(100, "7d");
    expect(text()).toBe("$100");
  });

  it("takes a new value at once while the key stays the same (a live refresh)", () => {
    const { update } = setup(100, "7d");
    update(180, "7d");
    expect(text()).toBe("$180");
  });

  it("counts from the old value to the new one when the key changes", async () => {
    const { update } = setup(100, "7d");
    update(200, "30d");
    // On its way: somewhere between the two, not already at the end.
    await vi.waitFor(() => expect(value()).toBeGreaterThan(100));
    expect(value()).toBeLessThan(200);
    await vi.waitFor(() => expect(text()).toBe("$200"), { timeout: 1500 });
  });

  it("counts when the new value arrives after the key changed (the data had to load)", async () => {
    const { update } = setup(100, "7d");
    update(100, "30d"); // switched, nothing new yet: stays put
    expect(text()).toBe("$100");
    update(200, "30d"); // the data arrived
    await vi.waitFor(() => expect(value()).toBeGreaterThan(100));
    expect(value()).toBeLessThan(200);
    await vi.waitFor(() => expect(text()).toBe("$200"), { timeout: 1500 });
  });

  it("counts only once per switch: the next refresh just takes the value", async () => {
    const { update } = setup(100, "7d");
    update(200, "30d");
    await vi.waitFor(() => expect(text()).toBe("$200"), { timeout: 1500 });
    update(260, "30d");
    expect(text()).toBe("$260");
  });

  it("goes straight to the new value under reduced motion", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { update } = setup(100, "7d");
    update(200, "30d");
    expect(text()).toBe("$200");
  });

  it("does not count from or to a missing number", () => {
    const { update } = setup(null, "7d");
    update(50, "30d");
    expect(text()).toBe("$50");
    update(null, "1y");
    expect(text()).toBe("-");
  });

  it("turns around from where it is when the key changes again mid-count", async () => {
    const { update } = setup(100, "a");
    update(200, "b");
    await vi.waitFor(() => expect(value()).toBeGreaterThan(130));
    const partway = value();
    update(100, "c");
    await wait(30);
    // It reverses from there: no jump to the far end, none back to the start.
    expect(Math.abs(value() - partway)).toBeLessThan(40);
    await vi.waitFor(() => expect(text()).toBe("$100"), { timeout: 1500 });
  });
});
