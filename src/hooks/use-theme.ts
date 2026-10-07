"use client";

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

// The `dark` class on <html> is the single source of truth, so CSS, the init
// script and React all agree. We subscribe to it rather than copying it into
// React state.

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// What the server (and the hydration pass) renders.
const getServerSnapshot = (): Theme => DEFAULT_THEME;

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // React Strict Mode's dev-only remount resets <html> to the attributes JSX
  // declares, wiping what the init script set. Re-apply before paint. No-op in production.
  useLayoutEffect(() => {
    const stored = readStored();
    if (stored && stored !== getSnapshot()) apply(stored);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    apply(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode / blocked storage: the theme still applies for this visit.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme, setTheme, toggleTheme };
}
