"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import type { CoinDetail } from "@/lib/api/schemas";
import { cn } from "@/lib/utils";

const COLLAPSE_AFTER = 380;

/** Plain-text description (see lib/sanitize), collapsed to a teaser when it's long. */
export function AboutSection({ coin }: { coin: CoinDetail }) {
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const paragraphs = coin.description;
  const total = paragraphs.reduce((n, p) => n + p.length, 0);
  const collapsible = total > COLLAPSE_AFTER;

  if (paragraphs.length === 0 && coin.categories.length === 0) return null;

  return (
    <section aria-labelledby="about-heading" className="space-y-8">
      <div className="space-y-4">
        <SectionLabel>About</SectionLabel>
        <h2 id="about-heading" className="text-heading-md text-primary">
          What is {coin.name}?
        </h2>
      </div>

      {paragraphs.length > 0 && (
        <div className="max-w-2xl space-y-4">
          <div
            id={textId}
            className={cn(
              "space-y-4 text-body-lg text-secondary",
              collapsible && !expanded && "line-clamp-5",
            )}
          >
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {collapsible && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={textId}
              onClick={() => setExpanded((e) => !e)}
              className="decoration-strong text-body-md text-primary underline underline-offset-4 transition-colors duration-fast ease-standard hover:decoration-inherit"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      {coin.categories.length > 0 && (
        <ul aria-label="Categories" className="flex flex-wrap gap-2">
          {coin.categories.map((c) => (
            <li key={c}>
              <Badge variant="outline">{c}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
