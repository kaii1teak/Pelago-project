import { ExternalLink } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import type { CoinDetail } from "@/lib/api/schemas";
import { hostnameOf } from "@/lib/url";

/** Hrefs reach here already filtered to http(s) by the schema (see lib/url). */
function buildLinks(coin: CoinDetail) {
  const l = coin.links;
  const rows: { label: string; href: string }[] = [];
  if (l.website) rows.push({ label: "Website", href: l.website });
  if (l.whitepaper) rows.push({ label: "Whitepaper", href: l.whitepaper });
  for (const href of l.explorers) rows.push({ label: "Explorer", href });
  if (l.forum) rows.push({ label: "Forum", href: l.forum });
  if (l.reddit) rows.push({ label: "Reddit", href: l.reddit });
  if (l.twitter) rows.push({ label: "X", href: l.twitter });
  if (l.github) rows.push({ label: "GitHub", href: l.github });
  return rows;
}

export function CoinLinks({ coin }: { coin: CoinDetail }) {
  const links = buildLinks(coin);
  if (links.length === 0) return null;

  return (
    <section aria-labelledby="links-heading" className="space-y-8">
      <div className="space-y-4">
        <SectionLabel>Links</SectionLabel>
        <h2 id="links-heading" className="text-heading-md text-primary">
          Around the web
        </h2>
      </div>

      <ul className="border-t border-primary">
        {links.map(({ label, href }) => (
          <li key={`${label}-${href}`} className="border-b border-primary">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-14 items-center justify-between gap-6 px-2 py-3 transition-colors duration-150 ease-standard hover:bg-overlay-hover"
            >
              <span className="shrink-0 label-mono text-muted">{label}</span>
              <span className="flex min-w-0 items-center gap-2 num text-mono-md text-primary">
                <span className="min-w-0 text-right break-all">{hostnameOf(href)}</span>
                <ExternalLink
                  className="size-4 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <span className="sr-only">(opens in a new tab)</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
