import { CoinSkeleton } from "@/components/coin/coin-skeleton";

/** Shown instantly on navigation while the server renders the asset page. */
export default function Loading() {
  return (
    <div className="page-container pt-12 md:pt-16">
      <CoinSkeleton />
    </div>
  );
}
