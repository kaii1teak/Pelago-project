import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";

export const metadata: Metadata = { title: "Asset not found" };

export default function CoinNotFound() {
  return (
    <section className="page-container flex min-h-hero flex-col items-center justify-center gap-8 py-24 text-center">
      <SectionLabel>Error 404</SectionLabel>
      <h1 className="max-w-175 text-heading-2xl text-primary">
        We couldn&apos;t find that asset.
      </h1>
      <p className="max-w-md text-body-lg text-secondary">
        The link may be mistyped, or the asset has been delisted. Pick one from the
        markets list instead.
      </p>
      <Link href="/markets" className={buttonVariants({ size: "lg" })}>
        Browse markets
      </Link>
    </section>
  );
}
