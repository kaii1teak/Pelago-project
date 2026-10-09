"use client";

import Link from "next/link";
import { setSubject, type Subject } from "@/lib/shared-subject";
import { NAV_FORWARD } from "./view-transition";

/**
 * A link to a coin's page. Going there is "forward" (deeper), and the coin is remembered
 * so its logo, name and price can travel from this row into the page header (see
 * SharedCoin and lib/shared-subject.ts).
 */
export function CoinLink({
  coin,
  className,
  tabIndex,
  children,
}: {
  coin: Subject;
  className?: string;
  /** -1 for a copy of a link that sits where the keyboard shouldn't land (a hidden tooltip). */
  tabIndex?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/coin/${coin.id}`}
      transitionTypes={[NAV_FORWARD]}

      onClick={() =>
        setSubject({
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol,
          image: coin.image,
          price: coin.price,
        })
      }
      className={className}
      tabIndex={tabIndex}
    >
      {children}
    </Link>
  );
}
