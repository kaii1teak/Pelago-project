"use client";

import { useParams } from "next/navigation";
import { SharedCoinTarget } from "@/components/motion/shared-coin";
import { CoinLogo } from "@/components/ui/coin-logo";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubject } from "@/lib/shared-subject";

/**
 * The header while the asset loads. When the visitor clicked a coin to get here, that coin's
 * logo, name and price are already known: they are drawn for real (named, so the ones in the
 * clicked row morph into them) and only the rest stays a placeholder. Otherwise, bars.
 */
function SkeletonHeader() {
  const subject = useSubject();
  const { id } = useParams<{ id?: string }>();

  if (!subject || subject.id !== id) {
    return (
      <>
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-72" />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <SharedCoinTarget part="logo">
          <CoinLogo src={subject.image} name={subject.name} size={48} />
        </SharedCoinTarget>
        <SharedCoinTarget part="name">
          <div className="space-y-2">
            <span className="block text-heading-xl text-primary">{subject.name}</span>
            <span className="block num text-mono-md text-muted">{subject.symbol}</span>
          </div>
        </SharedCoinTarget>
      </div>
      <div className="flex h-10 items-center">
        <SharedCoinTarget part="price">
          <Price value={subject.price} className="text-heading-lg text-primary" />
        </SharedCoinTarget>
      </div>
    </>
  );
}

/** Mirrors the loaded layout (header, chart box, stat rows) so nothing moves when data arrives. */
export function CoinSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading asset"
      className="space-y-20 md:space-y-28"
    >
      <div className="space-y-8">
        <Skeleton className="h-3 w-40" />
        <SkeletonHeader />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-chart w-full rounded-none" />
      </div>
      <div className="border-t border-primary">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex h-14 items-center justify-between border-b border-primary px-2"
          >
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
