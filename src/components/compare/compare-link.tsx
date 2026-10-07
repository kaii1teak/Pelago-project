"use client";

import { GitCompareArrows } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useCompareStore } from "@/stores/compare";

/**
 * Starts a comparison from an asset page: adds the coin to the saved selection
 * (ignored if it's already there or the comparison is full) and opens /compare,
 * which shows it next to whatever was already being compared.
 */
export function CompareLink({ id, name }: { id: string; name: string }) {
  const add = useCompareStore((s) => s.add);
  return (
    <Link
      href="/compare"
      onClick={() => add(id)}
      aria-label={`Compare ${name} with other assets`}
      className={buttonVariants({ variant: "outline", size: "md" })}
    >
      <GitCompareArrows aria-hidden="true" />
      Compare
    </Link>
  );
}
