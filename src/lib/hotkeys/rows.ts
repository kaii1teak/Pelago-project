/**
 * Moving through the rows of a table with the keyboard. A row opts in with `data-hotkey-row`
 * (and tabIndex -1, so it can take focus without becoming a Tab stop); focus is the
 * "selected row", which gives it the focus ring and tells screen readers where it is.
 */
export const ROW = "[data-hotkey-row]";

const visible = (el: HTMLElement) => {
  const box = el.getBoundingClientRect();
  return !el.closest("[inert]") && (box.width > 0 || box.height > 0);
};

const rows = () => [...document.querySelectorAll<HTMLElement>(ROW)].filter(visible);

/** The row that has focus, or contains what has. */
export const currentRow = () => document.activeElement?.closest<HTMLElement>(ROW) ?? null;

/** Focus the next (1) or previous (-1) row. Starts at the first or last row on screen when none is selected. */
export function moveRow(delta: 1 | -1): boolean {
  const all = rows();
  if (all.length === 0) return false;
  const now = currentRow();
  const index = now ? all.indexOf(now) : -1;

  let target: HTMLElement | undefined;
  if (index >= 0) {
    target = all[Math.min(all.length - 1, Math.max(0, index + delta))];
  } else {
    const onScreen = all.filter((row) => {
      const box = row.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight;
    });
    const pool = onScreen.length ? onScreen : all;
    target = delta === 1 ? pool[0] : pool.at(-1);
  }
  if (!target) return false;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "nearest" });
  return true;
}

/** Open the selected row: follow its link to the asset. Only when the row itself has focus (Enter on a button or link inside it is theirs). */
export function openRow(): boolean {
  const row = document.activeElement;
  if (!(row instanceof HTMLElement) || !row.matches(ROW)) return false;
  const link = row.querySelector<HTMLAnchorElement>("a[href]");
  if (!link) return false;
  link.click();
  return true;
}

/** Add the selected row's asset to the watchlist, or take it off. */
export function toggleRowWatch(): boolean {
  const star = currentRow()?.querySelector<HTMLButtonElement>("button[aria-pressed]");
  if (!star) return false;
  star.click();
  return true;
}
