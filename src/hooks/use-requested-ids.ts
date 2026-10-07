import { useState } from "react";

/**
 * The ids to ask the API about: it only ever GROWS. Taking an id off a list
 * changes what is shown but not what is requested, so removing is instant and
 * costs no upstream call (the row just stops matching). Adding one grows it,
 * which is the only time a new request is needed.
 *
 * Adjusting state while rendering (rather than in an effect) skips a frame of
 * stale requests: React re-renders straight away with the new value.
 */
export function useRequestedIds(ids: readonly string[], enabled = true) {
  const [requested, setRequested] = useState<readonly string[]>([]);
  if (enabled && !ids.every((id) => requested.includes(id))) {
    setRequested([...new Set([...requested, ...ids])]);
  }
  return requested;
}
