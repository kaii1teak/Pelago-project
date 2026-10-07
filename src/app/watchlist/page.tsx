import type { Metadata } from "next";
import { WatchlistView } from "@/components/watchlist/watchlist-view";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "The assets you've starred, with live prices.",
  // The list is private to this browser, so there is nothing here for a crawler.
  robots: { index: false },
};

/**
 * Static: the saved list lives in localStorage, so there is no per-request data
 * for the server to prefetch. It renders the frame; the client fills in the rows.
 */
export default function WatchlistPage() {
  return (
    <div className="page-container pt-16">
      <WatchlistView />
    </div>
  );
}
