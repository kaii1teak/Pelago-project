import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";
import { useTheme } from "./use-theme";

const root = document.documentElement;

beforeEach(() => {
  root.classList.remove("dark");
  localStorage.clear();
});

describe("useTheme", () => {
  it("defaults to light", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(root.classList.contains("dark")).toBe(false);
  });

  it("reads the dark class that the init script set", () => {
    root.classList.add("dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });

  it("toggles the class on <html>, persists the choice, and re-renders", async () => {
    const { result } = renderHook(() => useTheme());
    await act(async () => result.current.toggleTheme());
    expect(root.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(result.current.theme).toBe("dark");

    await act(async () => result.current.toggleTheme());
    expect(root.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(result.current.theme).toBe("light");
  });

  it("setTheme applies an explicit theme", async () => {
    const { result } = renderHook(() => useTheme());
    await act(async () => result.current.setTheme("dark"));
    await act(async () => result.current.setTheme("dark"));
    expect(root.classList.contains("dark")).toBe(true);
  });

  it("still applies the theme for this visit when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useTheme());
    await act(async () => result.current.toggleTheme());
    expect(root.classList.contains("dark")).toBe(true);
    vi.restoreAllMocks();
  });

  it("re-applies a stored dark theme if the class was wiped (React dev remount)", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    renderHook(() => useTheme());
    expect(root.classList.contains("dark")).toBe(true);
  });
});

describe("THEME_INIT_SCRIPT (runs before first paint)", () => {
  const run = () => new Function(THEME_INIT_SCRIPT)();

  it("adds the dark class for a saved dark preference", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    run();
    expect(root.classList.contains("dark")).toBe(true);
  });

  it("leaves light alone, and ignores junk", () => {
    run();
    expect(root.classList.contains("dark")).toBe(false);
    localStorage.setItem(THEME_STORAGE_KEY, "purple");
    run();
    expect(root.classList.contains("dark")).toBe(false);
  });

  it("never throws when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(run).not.toThrow();
    vi.restoreAllMocks();
  });
});
