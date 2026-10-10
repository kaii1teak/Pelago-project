
import Link from "next/link";
import {LineFan} from "@/components/decor/line-fan";
import {StatsStrip} from "@/components/home/stats-strip";
import {buttonVariants} from "@/components/ui/button";
import {SectionLabel} from "@/components/ui/section-label";
import {HERO_FAN} from "@/lib/line-fan";

/**
 * The headline, copy and buttons are plain server-rendered HTML so they paint
 * with the first response; only their entrance is staggered, in CSS, which
 * needs no JavaScript to run. So are the lines behind them: a static SVG, no animation.
 * Height is the viewport below the header, with the market numbers pinned to
 * its bottom edge so they're above the fold.
 */
export function Hero() {
    return (
        <section className="relative isolate overflow-clip">
            <div className="page-container flex min-h-hero flex-col">
                <div className="flex flex-1 flex-col items-center pt-hero pb-16 text-center">
                    <div className="relative top-7 flex flex-col items-center">
                        <div className="relative flex flex-col items-center">
                            {/* Blurs the lines behind the text. It is its own layer between the lines
                  (-z-10) and the text, not a background on a parent of the lines: a blur only
                  affects what is BEHIND the element, and a filter on a parent would trap the
                  lines inside it. Size: the insets. Strength: backdrop-blur-sm / md / lg / xl.
                  Softness of the edge: where the mask goes from black to transparent. */}
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute -inset-x-12 -inset-y-10 -z-5 backdrop-blur-md [mask-image:radial-gradient(ellipse_closest-side,black_45%,transparent)]"
                            />
                            <SectionLabel>Live crypto markets</SectionLabel>

                            <h1 className="mt-6 max-w-175 text-heading-2xl font-semibold text-primary">
                                The market, in motion.
                            </h1>

                            <p className="mt-5 max-w-xl text-body-xl text-secondary">
                                Live prices, clear charts and side-by-side comparisons for the assets that
                                matter, in one fast, focused dashboard.
                            </p>
                        </div>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                        <Link href="/markets" className={buttonVariants({size: "lg"})}>
                            Explore markets
                            {/*<ArrowRight aria-hidden="true"/>*/}
                        </Link>
                        <Link
                            href="/compare"
                            className={buttonVariants({variant: "outline", size: "lg"})}
                        >
                            Compare assets
                        </Link>
                    </div>
                    {/* The lines' meeting point sits in this zone, so it stays the same distance
              below the buttons on every screen. The fan is viewport-wide and taller than the hero, which crops it
              (so nothing slips under the navbar). */}
                    <div aria-hidden="true" className="relative mt-25 h-24 w-full md:h-32">
                        <div
                            className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-300 w-screen -translate-x-1/2 -translate-y-[60rem]">
                            <LineFan fan={HERO_FAN} className="size-full"/>
                        </div>
                    </div>
                </div>
                    </div>
                <StatsStrip/>
            </div>
        </section>
    );
}
