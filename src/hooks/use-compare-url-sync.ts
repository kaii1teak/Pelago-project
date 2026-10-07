"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { parseCompareIds } from "@/lib/compare";
import { withAssets } from "@/lib/compare-url";

/**
 * Keeps the address bar and the saved selection telling the same story, so a link
 * always reproduces the comparison:
 *
 *  - a link that names assets (?assets=bitcoin,ethereum) wins: it replaces the
 *    saved selection, once, when it arrives (opening a shared link, or following
 *    one inside the app);
 *  - otherwise the saved selection is written into the URL, and every later change
 *    to it is mirrored there (replaceState: no history entries for each tweak).
 *
 * "Arrives" matters: after we write the URL ourselves, the same value comes back
 * through useSearchParams and must not be mistaken for a new link, or removing
 * an asset would be undone by the URL still naming it.
 */
export function useCompareUrlSync(
  hydrated: boolean,
  ids: readonly string[],
  setIds: (ids: readonly string[]) => void,
) {
  const searchParams = useSearchParams();
  const urlKey = parseCompareIds(searchParams.get("assets")).join(",");
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const idsKey = ids.join(",");

    const arrived = urlKey !== "" && urlKey !== lastWritten.current;
    if (arrived && urlKey !== idsKey) {
      setIds(urlKey.split(","));
      return; // the store change runs this effect again, which then mirrors it
    }

    const next = withAssets(window.location.search, ids);
    if (next !== window.location.search) {
      window.history.replaceState(null, "", `${window.location.pathname}${next}`);
    }
    lastWritten.current = idsKey;
  }, [hydrated, urlKey, ids, setIds]);
}
