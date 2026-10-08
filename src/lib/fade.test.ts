import { afterEach, describe, expect, it, vi } from "vitest";
import { fadeIn } from "./fade";

afterEach(() => vi.restoreAllMocks());

describe("fadeIn", () => {
  it("fades from transparent to opaque over the base duration, on the standard curve", () => {
    const el = document.createElement("div");
    const animate = vi.fn();
    el.animate = animate;
    fadeIn(el);
    expect(animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], {
      duration: 200,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    });
  });

  it("does nothing, and does not throw, where animations are not supported", () => {
    const el = document.createElement("div");
    // jsdom has no Element.animate
    expect(() => fadeIn(el)).not.toThrow();
  });
});
