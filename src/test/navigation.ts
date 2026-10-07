import { useMemo, useSyncExternalStore } from "react";

/**
 * A minimal stand-in for next/navigation that is backed by the *real* jsdom URL.
 * Next integrates window.history.pushState/replaceState with useSearchParams, so
 * to test code that uses them we patch history to notify subscribers, the same
 * way the framework does.
 */
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

let restore: (() => void) | null = null;

/** Patch history for the current test. Call `uninstallHistoryMock()` afterwards. */
export function installHistoryMock() {
  uninstallHistoryMock();
  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  window.history.pushState = (...args) => {
    push(...args);
    notify();
  };
  window.history.replaceState = (...args) => {
    replace(...args);
    notify();
  };
  window.addEventListener("popstate", notify);
  restore = () => {
    window.history.pushState = push;
    window.history.replaceState = replace;
    window.removeEventListener("popstate", notify);
  };
}

export function uninstallHistoryMock() {
  restore?.();
  restore = null;
}

/** Simulate an external navigation (Back/Forward, a pasted link). */
export function navigateExternally(url: string) {
  window.history.pushState(null, "", url);
}

export const navigationMock = {
  useSearchParams: () => {
    const search = useSyncExternalStore(
      subscribe,
      () => window.location.search,
      () => "",
    );
    return useMemo(() => new URLSearchParams(search), [search]);
  },
  usePathname: () => window.location.pathname,
};
