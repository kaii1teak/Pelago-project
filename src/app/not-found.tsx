import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="page-container flex min-h-hero flex-col items-center justify-center gap-8 py-24 text-center">
      <SectionLabel>Error 404</SectionLabel>
      <h1 className="max-w-175 text-heading-2xl text-primary">
        This page drifted off the map.
      </h1>
      <p className="max-w-md text-body-lg text-secondary">
        The page you&apos;re after doesn&apos;t exist, or the asset has been delisted.
        Head back and pick up the trail.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Back to home
        </Link>
        <Link
          href="/markets"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Browse markets
        </Link>
      </div>
    </section>
  );
}
