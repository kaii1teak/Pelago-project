import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { buttonVariants } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";

export function CtaSection() {
  return (
    <Reveal>
      <section aria-labelledby="cta-heading" className="border-t border-primary">
        <div className="page-container flex flex-col gap-10 pt-12 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-4">
            <SectionLabel>Get started</SectionLabel>
            <h2 id="cta-heading" className="text-heading-xl text-primary">
              Start with the top 100.
            </h2>
            <p className="text-body-lg text-secondary">
              Sort, filter and search every major asset, then follow the ones you care
              about.
            </p>
          </div>
          <Link href="/markets" className={buttonVariants({ size: "lg" })}>
            Open the markets
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </Reveal>
  );
}
