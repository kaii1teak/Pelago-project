import { render, screen } from "@testing-library/react";
import type * as MotionReact from "motion/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CountUp } from "./count-up";

// Control the animation engine and viewport so the test decides when things happen.
const state = vi.hoisted(() => ({
  reduce: false,
  inView: true,
  calls: [] as unknown[][],
}));

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof MotionReact>()),
  useInView: () => state.inView,
  useReducedMotion: () => state.reduce,
  animate: (...args: unknown[]) => {
    state.calls.push(args);
    return { stop: vi.fn() };
  },
}));

type AnimateOptions = { onUpdate: (v: number) => void; onComplete: () => void };
const options = (call: unknown[]) => call[2] as AnimateOptions;

/** The animated (aria-hidden) text node, as opposed to the screen-reader copy. */
const animatedText = (container: HTMLElement) =>
  container.querySelector('[aria-hidden="true"]')!;

beforeEach(() => {
  state.reduce = false;
  state.inView = true;
  state.calls = [];
});

describe("CountUp hydration hand-off", () => {
  it("stays held back (idle) while it hasn't scrolled into view, still holding the real number", () => {
    state.inView = false;
    const { container } = render(<CountUp value={1000} format="integer" />);
    expect(animatedText(container)).toHaveAttribute("data-count", "idle");
    expect(animatedText(container)).toHaveTextContent("1,000"); // SSR value, hidden by CSS
    expect(state.calls).toHaveLength(0);
  });

  it("writes the starting value *before* revealing, so the final number never flashes", () => {
    const { container } = render(<CountUp value={1000} format="integer" />);
    const el = animatedText(container);
    expect(el).toHaveAttribute("data-count", "ready");
    // Revealed, but already showing the count's starting point, not the final number.
    expect(el).toHaveTextContent("0");
    expect(el).not.toHaveTextContent("1,000");
  });

  it("reveals the final value straight away for reduced motion", () => {
    state.reduce = true;
    const { container } = render(<CountUp value={1000} format="integer" />);
    expect(animatedText(container)).toHaveAttribute("data-count", "ready");
    expect(animatedText(container)).toHaveTextContent("1,000");
  });
});

describe("CountUp", () => {
  it("renders the final value up front, for crawlers and no-JS users", () => {
    state.reduce = true;
    render(<CountUp value={17432} format="integer" />);
    expect(screen.getAllByText("17,432")).toHaveLength(2);
  });

  it("counts up from zero to the value on first reveal", () => {
    const { container } = render(<CountUp value={1000} format="integer" />);
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]!.slice(0, 2)).toEqual([0, 1000]);

    options(state.calls[0]!).onUpdate(250);
    expect(animatedText(container)).toHaveTextContent("250");
    options(state.calls[0]!).onComplete();
    expect(animatedText(container)).toHaveTextContent("1,000");
  });

  it("counts from the number on screen to the new one, briefly, when live data changes afterwards", () => {
    const { container, rerender } = render(<CountUp value={1000} format="integer" />);
    options(state.calls[0]!).onComplete();
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]![2]).toMatchObject({ duration: 1.2 }); // the first reveal is slow

    rerender(<CountUp value={1200} format="integer" />);
    expect(state.calls).toHaveLength(2);
    expect(state.calls[1]!.slice(0, 2)).toEqual([1000, 1200]);
    expect(state.calls[1]![2]).toMatchObject({ duration: 0.3 }); // an update is quick
    options(state.calls[1]!).onUpdate(1100);
    expect(animatedText(container)).toHaveTextContent("1,100");
    options(state.calls[1]!).onComplete();
    expect(animatedText(container)).toHaveTextContent("1,200");
  });

  it("an update that arrives mid-count continues from where the number is", () => {
    const { rerender } = render(<CountUp value={1000} format="integer" />);
    options(state.calls[0]!).onUpdate(400); // halfway through the first reveal
    rerender(<CountUp value={1200} format="integer" />);
    expect(state.calls[1]!.slice(0, 2)).toEqual([400, 1200]);
  });

  it("does not animate an update that changes nothing", () => {
    const { rerender } = render(<CountUp value={1000} format="integer" />);
    options(state.calls[0]!).onComplete();
    rerender(<CountUp value={1000} format="integer" />);
    expect(state.calls).toHaveLength(1);
  });

  it("never animates for reduced-motion users", () => {
    state.reduce = true;
    const { container } = render(<CountUp value={1000} format="integer" />);
    expect(state.calls).toHaveLength(0);
    expect(animatedText(container)).toHaveTextContent("1,000");
  });

  it("keeps screen readers on the final value, not the in-flight number", () => {
    const { container } = render(<CountUp value={1000} format="integer" />);
    options(state.calls[0]!).onUpdate(333);
    expect(animatedText(container)).toHaveTextContent("333");
    expect(container.querySelector(".sr-only")).toHaveTextContent("1,000");
  });

  it("formats by name: usd, compact, percent", () => {
    state.reduce = true;
    const { unmount } = render(<CountUp value={2_410_000_000_000} format="compactUsd" />);
    expect(screen.getAllByText("$2.41T")).toHaveLength(2);
    unmount();
    render(<CountUp value={52.41} format="plainPercent" />);
    expect(screen.getAllByText("52.4%")).toHaveLength(2);
  });
});
