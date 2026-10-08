/** How long the fallback waits when the CSS doesn't say (see --theme-duration in globals.css). */
const FALLBACK_MS = 500;

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** "500ms" -> 500, "0.8s" -> 800; anything else -> the fallback. */
export function parseDuration(text: string): number {
  const match = text.trim().match(/^(\d*\.?\d+)(ms|s)$/);
  if (!match) return FALLBACK_MS;
  const value = Number(match[1]);
  return match[2] === "s" ? value * 1000 : value;
}

/** --theme-duration as the page has it, in ms. */
const themeDurationMs = () =>
  parseDuration(
    getComputedStyle(document.documentElement).getPropertyValue("--theme-duration"),
  );

/**
 * Runs `apply` (which flips the theme) with a transition:
 *  - with the View Transitions API, the browser fades the old picture of the page into the
 *    new one, all at once. All this file does is start it: how long and how it eases
 *    are --theme-duration and --theme-ease in globals.css. That crossfade is only
 *    opacity, so it stays on for reduced motion too;
 *  - without the API, every color fades over the same time (CSS transitions), and
 *    for reduced motion the change is instant.
 * `apply` always runs synchronously enough that the DOM has the new theme when it returns
 * (the API calls it at once), so nothing depends on the animation finishing.
 */
export function runThemeChange(apply: () => void) {
  const root = document.documentElement;

  // A change already in flight: don't stack another snapshot on it.
  if (root.dataset.vt) {
    apply();
    return;
  }

  if (typeof document.startViewTransition !== "function") {
    if (reducedMotion()) {
      apply();
      return;
    }
    root.dataset.vt = "theme-blend";
    const wait = themeDurationMs() + 50;
    apply();
    window.setTimeout(() => {
      delete root.dataset.vt;
    }, wait);
    return;
  }

  root.dataset.vt = "theme";
  document.startViewTransition(apply).finished.finally(() => {
    delete root.dataset.vt;
  });
}
