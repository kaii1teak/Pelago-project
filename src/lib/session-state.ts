/**
 * Whether the page the visitor is looking at is the first one of this visit. The first
 * page arrives as server-rendered HTML, already visible, so nothing on it may animate
 * in (it would flash invisible before React takes over, and slow down the first paint).
 * Pages reached by navigating afterwards are built in the browser and may.
 *
 * Module scope on purpose: it survives route changes. On the server it never flips
 * (effects don't run), so server renders are always the visible, un-animated state.
 */
let hydrated = false;

export const isFirstPage = () => !hydrated;

/** Called once the first page has mounted (see app/template.tsx). */
export function markHydrated() {
  hydrated = true;
}
