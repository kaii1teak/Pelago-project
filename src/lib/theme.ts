export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "pelago-theme";
export const DEFAULT_THEME: Theme = "light";

/**
 * <meta name="theme-color"> needs literal colors (it can't read CSS variables),
 * so these two mirror --bg-primary in globals.css. One of only two places a hex
 * lives outside the token file (the other is the favicon).
 */
export const THEME_COLOR: Record<Theme, string> = {
  light: "#fcfcfc",
  dark: "#0a0a0a",
};

/**
 * Runs synchronously in <head>, before first paint, so a returning dark-theme
 * visitor never sees a light flash. Kept as a plain string because it has to
 * execute before React exists. Falls through silently if storage is blocked.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`;
