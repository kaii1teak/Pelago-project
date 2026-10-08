"use client";

import { useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { RowIndex } from "@/components/ui/row-index";
import { SectionHeading } from "@/components/ui/section-heading";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    title: "Live, without the noise",
    body: "Prices refresh every minute through a cached, rate-limit-aware API layer, so the numbers stay current without hammering the source.",
    href: "/markets",
    cta: "Open the markets",
  },
  {
    title: "Charts built for reading",
    body: "Switch between line and candle views across 24 hours, 7 days, 30 days and a full year, with clear detail on hover.",
    href: "/markets",
    cta: "Browse assets",
  },
  {
    title: "Compare on equal footing",
    body: "Put up to four assets on one chart as percentage change from the same starting point, with their stats side by side.",
    href: "/compare",
    cta: "Compare assets",
  },
  {
    title: "A watchlist that remembers",
    body: "Star assets anywhere. Your list lives in your browser with live prices. No account, no sign-up.",
    href: "/watchlist",
    cta: "View your watchlist",
  },
] as const;

/**
 * Features as an index list. On large screens the section is a tall scroll
 * track holding a sticky panel: as you scroll through the track the active item
 * changes (native scroll, nothing is hijacked), and each item is also a button
 * that scrolls to its step so it works from the keyboard. Below `lg` the same
 * list is a plain accordion, with CSS (not JS) providing the layout switch.
 */
export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isDesktop = useMediaQuery("(min-width: 64rem)");
  const reduceMotion = useReducedMotion();
  const [scrollActive, setScrollActive] = useState(0);
  const [mobileOpen, setMobileOpen] = useState<number | null>(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (!isDesktop) return;
    const index = Math.floor(progress * FEATURES.length);
    setScrollActive(Math.min(FEATURES.length - 1, Math.max(0, index)));
  });

  const goTo = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const range = section.offsetHeight - window.innerHeight;
    // Aim for the middle of the item's band so it's unambiguously the active one.
    window.scrollTo({
      top: top + ((index + 0.5) / FEATURES.length) * range,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  const activeIndex = isDesktop ? scrollActive : (mobileOpen ?? 0);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="features-heading"
      style={{ "--steps": FEATURES.length - 1 } as React.CSSProperties}
      className="lg:feature-track"
    >
      {/* The panel centers one row; the row is exactly as tall as the list, so the left box
          (same top and bottom rules as the list's first and last) is the same height as it. */}
      <div className="page-container lg:sticky lg:top-header lg:flex lg:h-panel lg:items-center">
        <div className="lg:grid lg:w-full lg:grid-cols-[5fr_7fr]">
          {/* lg:pb-0: the mobile gap under the heading would push the text off-center here.
            The text block is centered in this box; lg:max-w-md is its width (narrower = more air). */}
          <div className="pb-12 lg:flex lg:flex-col lg:items-center lg:justify-center lg:border-y lg:border-primary lg:px-6 lg:pb-0">
            <div className="lg:w-full lg:max-w-md">
              <SectionHeading
                id="features-heading"
                label="Why Pelago"
                title="Everything you need, nothing you don't."
                description="A focused set of tools for following the market: fast, readable and honest about its data."
              />
              <p
                className="mt-8 hidden num text-mono-md text-muted lg:block"
                aria-hidden="true"
              >
                [{String(activeIndex + 1).padStart(2, "0")}] / [
                {String(FEATURES.length).padStart(2, "0")}]
              </p>
            </div>
          </div>

          <ol className="border-t border-primary lg:flex lg:flex-col lg:border-t-0">
            {FEATURES.map((feature, i) => {
              const expanded = isDesktop ? scrollActive === i : mobileOpen === i;
              return (
                <li
                  key={feature.title}
                  className="lg:line-bleed-bottom first:lg:line-bleed-top border-b border-primary lg:border-b-0 lg:pl-6"
                >
                  <h3>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`feature-panel-${i}`}
                      onClick={() =>
                        isDesktop ? goTo(i) : setMobileOpen(expanded ? null : i)
                      }
                      // lg: the rows grow with the screen height, so the list fills more of the
                      // pinned panel (less empty space above and below it). Tune the 13svh.
                      className="flex min-h-20 w-full items-center justify-between gap-6 px-2 text-left lg:min-h-[clamp(5rem,13svh,9rem)] lg:px-0"
                    >
                      <span
                        className={cn(
                          "text-heading-md transition-colors duration-250 ease-standard",
                          expanded ? "text-primary" : "text-muted",
                        )}
                      >
                        {feature.title}
                      </span>
                      <RowIndex n={i + 1} />
                    </button>
                  </h3>
                  <div
                    id={`feature-panel-${i}`}
                    role="region"
                    className={cn(
                      "grid transition-[grid-template-rows] duration-250 ease-standard",
                      expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    {/* inert while collapsed: hidden content must not be reachable by Tab. */}
                    <div className="overflow-hidden" inert={!expanded}>
                      <div className="space-y-6 px-2 pb-8 lg:px-0">
                        <p className="max-w-xl text-body-xl text-secondary">
                          {feature.body}
                        </p>
                        <Link
                          href={feature.href}
                          className={buttonVariants({ size: "md" })}
                        >
                          {feature.cta}
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
