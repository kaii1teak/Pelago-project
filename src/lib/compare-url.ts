import { isCompareView, type CompareView } from "./compare";

/** The parameters this page owns, in the one order they are always written. */
const ORDER = ["assets", "view", "range"] as const;

/**
 * Rewrites a query string so the page's own parameters come last, in a fixed order
 * (assets, view, range). One state is then always one URL, whichever of them changed
 * last. Other parameters keep their place ahead of these. `search` may or may not
 * start with "?".
 */
function canonical(params: URLSearchParams): string {
  const own = ORDER.map((key) => [key, params.get(key)] as const);
  for (const key of ORDER) params.delete(key);
  for (const [key, value] of own) if (value !== null) params.set(key, value);
  // Commas are legal in a query string and much more readable than %2C.
  const out = params.toString().replaceAll("%2C", ",");
  return out ? `?${out}` : "";
}

export function withAssets(search: string, ids: readonly string[]): string {
  const params = new URLSearchParams(search);
  params.delete("assets");
  if (ids.length > 0) params.set("assets", ids.join(","));
  return canonical(params);
}

/** `view=price` is recorded; the default ("change") leaves the URL clean. */
export function withView(search: string, view: CompareView): string {
  const params = new URLSearchParams(search);
  params.delete("view");
  if (view === "price") params.set("view", "price");
  return canonical(params);
}

export function viewFrom(search: string | URLSearchParams): CompareView {
  const value = new URLSearchParams(search).get("view");
  return isCompareView(value) ? value : "change";
}

export const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);
