"use client";

import { useSubjectId } from "@/lib/shared-subject";
import { ViewTransition } from "./view-transition";

/** The three pieces of a coin that travel between a list row and the asset page header. */
export type CoinPart = "logo" | "name" | "price";

/**
 * Wraps one piece of a coin. It is only NAMED (so only a candidate for the morph) while
 * the coin is the chosen one, see lib/shared-subject.ts; `default="none"` keeps it from
 * also running a fade of its own on unrelated transitions.
 */
export function SharedCoin({
  id,
  part,
  children,
}: {
  id: string;
  part: CoinPart;
  children: React.ReactElement;
}) {
  const chosen = useSubjectId() === id;
  return (
    <ViewTransition
      name={chosen ? sharedName(part) : undefined}
      share="morph"
      default="none"
    >
      {children}
    </ViewTransition>
  );
}

/** The asset page's side: always named, there is only one coin on that page. */
export function SharedCoinTarget({
  part,
  children,
}: {
  part: CoinPart;
  children: React.ReactElement;
}) {
  return (
    <ViewTransition name={sharedName(part)} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}

export const sharedName = (part: CoinPart) => `coin-${part}`;
