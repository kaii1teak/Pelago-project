"use client";

import { Button } from "@/components/ui/button";

/**
 * Saved ids the market data no longer has a coin for (delisted, or an id that
 * changed). They would otherwise vanish from the list silently while still
 * counting against the cap, so they are shown here with a way to drop them.
 */
export function MissingAssets({
  ids,
  onRemove,
}: {
  ids: readonly string[];
  onRemove: (id: string) => void;
}) {
  if (ids.length === 0) return null;

  return (
    <section aria-labelledby="missing-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="missing-heading" className="text-heading-xs text-primary">
          {ids.length === 1
            ? "1 saved asset couldn't be found"
            : `${ids.length} saved assets couldn't be found`}
        </h2>
        <p className="text-body-md text-secondary">
          CoinGecko no longer lists {ids.length === 1 ? "it" : "them"}, or{" "}
          {ids.length === 1 ? "its" : "their"} id changed. You can remove{" "}
          {ids.length === 1 ? "it" : "them"} from your list.
        </p>
      </div>
      <ul className="border-t border-primary">
        {ids.map((id) => (
          <li
            key={id}
            className="flex min-h-14 items-center justify-between gap-4 border-b border-primary px-2"
          >
            <span className="num text-mono-md text-secondary">{id}</span>
            <Button
              variant="ghost"
              size="sm"
              data-missing-remove=""
              aria-label={`Remove ${id}`}
              onClick={() => onRemove(id)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
