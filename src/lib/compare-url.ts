/**
 * The query string for a selection: `assets` first, then `range` if there is
 * one, in that fixed order, so one state is always one URL. Other parameters
 * keep their place ahead of both. `search` may or may not start with "?".
 */
export function withAssets(search: string, ids: readonly string[]): string {
  const params = new URLSearchParams(search);
  const range = params.get("range");
  params.delete("assets");
  params.delete("range");
  if (ids.length > 0) params.set("assets", ids.join(","));
  if (range !== null) params.set("range", range);
  const out = params.toString().replaceAll("%2C", ",");
  return out ? `?${out}` : "";
}

export const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);
