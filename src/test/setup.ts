import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// Animations finish at once: tests assert the state after a change (a row removed, a chip
// gone), not the half second of getting there. That the motion is wired up is covered by
// the tests that look at the props and by checking the real thing in a browser.
MotionGlobalConfig.skipAnimations = true;

// jsdom doesn't implement these; components that observe size/visibility need them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.ResizeObserver ??= ResizeObserverStub;
globalThis.IntersectionObserver ??= IntersectionObserverStub as never;

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom doesn't implement scrolling; components that scroll a target into view need a stub.
Element.prototype.scrollIntoView ??= () => {};
