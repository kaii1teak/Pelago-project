import Link from "next/link";
import { LineFan } from "@/components/decor/line-fan";
import { FOOTER_FAN } from "@/lib/line-fan";
import { NAV_LINKS, SITE } from "@/lib/site";
import { Wordmark } from "./wordmark";
import { SectionLabel } from "@/components/ui/section-label";

export function Footer() {
  return (
    <footer className="mt-section">
      {/* The hero's line motif, cut at the horizon: the footer's top edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none h-40 overflow-hidden md:h-56"
      >
        <LineFan fan={FOOTER_FAN} className="size-full" />
      </div>

      <div className="border-t border-primary">
        <div className="page-container grid gap-12 py-16 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="max-w-sm space-y-4">
            <Wordmark />
            <p className="text-body-md text-secondary">{SITE.tagline}</p>
          </div>

          <nav aria-label="Footer">
            <SectionLabel as="h2" className="mb-4">
              Explore
            </SectionLabel>
            <ul className="space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-body-md text-secondary transition-colors duration-150 ease-standard hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <SectionLabel as="h2" className="mb-4">
              Data
            </SectionLabel>
            <p className="text-body-md text-secondary">
              Market data by{" "}
              <a
                href="https://www.coingecko.com/en/api"
                target="_blank"
                rel="noopener noreferrer"
                className="decoration-strong text-primary underline underline-offset-4 transition-colors duration-150 ease-standard hover:decoration-inherit"
              >
                CoinGecko
              </a>
              . Prices refresh about once a minute.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-primary">
        <div className="page-container flex flex-col gap-2 py-6 text-mono-sm text-muted sm:flex-row sm:justify-between">
          <p className="num">
            © {new Date().getFullYear()} Pelago. A frontend portfolio project.
          </p>
          <p className="num">For information only. Not financial advice.</p>
        </div>
      </div>
    </footer>
  );
}
