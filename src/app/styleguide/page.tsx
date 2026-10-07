import type { Metadata } from "next";
import { Search, Star } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CoinLogo } from "@/components/ui/coin-logo";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LiveBadge } from "@/components/ui/live-badge";
import { PercentChange } from "@/components/ui/percent-change";
import { Price } from "@/components/ui/price";
import { RowIndex } from "@/components/ui/row-index";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { ControlsDemo } from "./_components/controls-demo";
import { ErrorDemo } from "./_components/error-demo";
import { LiveDataCheck } from "./_components/live-data-check";
import { TabsDemo } from "./_components/tabs-demo";
import { SectionLabel } from "@/components/ui/section-label";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false },
};

const SERIES = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
  "bg-chart-8",
  "bg-chart-9",
  "bg-chart-10",
];

const SURFACES = [
  ["bg-primary", "bg-primary"],
  ["bg-subtle", "bg-subtle"],
  ["bg-secondary", "bg-secondary"],
  ["bg-tertiary", "bg-tertiary"],
  ["bg-inverse", "bg-inverse"],
] as const;

const SIGNALS = [
  ["accent", "bg-accent"],
  ["info", "bg-info"],
  ["success", "bg-success"],
  ["critical", "bg-critical"],
  ["warning", "bg-warning"],
] as const;

const TEXT = [
  ["text-primary", "text-primary"],
  ["text-secondary", "text-secondary"],
  ["text-muted", "text-muted"],
] as const;

const HEADINGS = [
  ["heading-3xl", "text-heading-3xl"],
  ["heading-2xl", "text-heading-2xl"],
  ["heading-xl", "text-heading-xl"],
  ["heading-lg", "text-heading-lg"],
  ["heading-md", "text-heading-md"],
  ["heading-sm", "text-heading-sm"],
  ["heading-xs", "text-heading-xs"],
] as const;

const BODY = [
  ["body-xl", "text-body-xl"],
  ["body-lg", "text-body-lg"],
  ["body-md", "text-body-md"],
  ["body-sm", "text-body-sm"],
  ["body-xs", "text-body-xs"],
] as const;

const UP = [3, 4, 3.6, 5, 4.8, 6.2, 5.9, 7.4];
const DOWN = [7.4, 6.8, 7.1, 5.9, 6.2, 4.8, 5.1, 3.9];

function Section({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <section className="space-y-8 border-t border-primary pt-8">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-heading-md text-primary">{title}</h2>
            {description && <p className="text-body-md text-secondary">{description}</p>}
          </div>
          <RowIndex n={index} />
        </div>
        {children}
      </section>
    </Reveal>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="space-y-2">
      <div className={`h-14 border border-primary ${className}`} />
      <p className="num text-mono-sm text-muted">{name}</p>
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <div className="page-container space-y-24 pt-16">
      <header className="space-y-6">
        <SectionLabel>Design system</SectionLabel>
        <h1 className="max-w-175 text-heading-2xl text-primary">
          Pelago, piece by piece.
        </h1>
        <p className="max-w-xl text-body-xl text-secondary">
          Every token, primitive and state used across the app. Toggle the theme in the
          header to check both.
        </p>
      </header>

      <Section
        index={1}
        title="Color"
        description="Semantic tokens that swap per theme. Components use these names, never raw values."
      >
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-3">
            <p className="label-mono text-muted">Surfaces</p>
            <div className="grid grid-cols-5 gap-3">
              {SURFACES.map(([name, cls]) => (
                <Swatch key={name} name={name.replace("bg-", "")} className={cls} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="label-mono text-muted">Accent and status</p>
            <div className="grid grid-cols-5 gap-3">
              {SIGNALS.map(([name, cls]) => (
                <Swatch key={name} name={name} className={cls} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="label-mono text-muted">Text</p>
            <div className="space-y-2 border border-primary p-4">
              {TEXT.map(([name, cls]) => (
                <p key={name} className={`text-body-lg ${cls}`}>
                  {name} <span className="num text-mono-sm">The quick brown fox</span>
                </p>
              ))}
              <p className="text-body-sm text-muted">
                <span className="num text-mono-sm">text-disabled</span> is for disabled
                controls only (WCAG exempts them), so it is never used for readable text.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <p className="label-mono text-muted">Chart series</p>
          <div className="grid grid-cols-5 gap-3 md:grid-cols-10">
            {SERIES.map((cls, i) => (
              <Swatch key={cls} name={`chart-${i + 1}`} className={cls} />
            ))}
          </div>
        </div>
      </Section>

      <Section
        index={2}
        title="Typography"
        description="Roboto for text, Roboto Mono for prices, tickers, numbers and index labels. Headings are weight 400 with strongly negative tracking."
      >
        <div className="space-y-6">
          {HEADINGS.map(([name, cls]) => (
            <div
              key={name}
              className="flex items-baseline gap-6 border-b border-primary pb-4"
            >
              <span className="w-28 shrink-0 num text-mono-sm text-muted">{name}</span>
              <p className={`${cls} text-primary`}>Every market, one view.</p>
            </div>
          ))}
          {BODY.map(([name, cls]) => (
            <div
              key={name}
              className="flex items-baseline gap-6 border-b border-primary pb-4"
            >
              <span className="w-28 shrink-0 num text-mono-sm text-muted">{name}</span>
              <p className={`${cls} text-secondary`}>
                Live prices and clear charts for the assets that matter.
              </p>
            </div>
          ))}
          <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
            <Price value={67432.1} className="text-mono-md text-primary" />
            <Price value={0.00001234} className="text-mono-md text-primary" />
            <Price value={2410000000000} compact className="text-mono-md text-primary" />
            <SectionLabel as="h3">Section label</SectionLabel>
            <RowIndex n={7} />
          </div>
        </div>
      </Section>

      <Section
        index={3}
        title="Buttons"
        description="2px radius, no shadow, color-only states (0.15s)."
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" variant="outline" aria-label="Add to watchlist">
              <Star aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Section>

      <Section index={4} title="Badges and change">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Neutral</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="gain">Gain</Badge>
            <Badge variant="loss">Loss</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <PercentChange value={4.21} className="text-mono-md" />
            <PercentChange value={-3.07} className="text-mono-md" />
            <PercentChange value={0} className="text-mono-md" />
            <PercentChange value={null} className="text-mono-md" />
            <span className="text-body-sm text-muted">
              Direction is always sign + arrow + text, never color alone. Green and red
              appear nowhere else in the data UI.
            </span>
          </div>
        </div>
      </Section>

      <Section index={5} title="Inputs, tabs and tooltips">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <label htmlFor="sg-search" className="label-mono text-muted">
              Search assets
            </label>
            <Input id="sg-search" placeholder="Bitcoin, ETH, solana…" icon={<Search />} />
          </div>
          <div className="space-y-3">
            <p className="label-mono text-muted">Range selector (arrow keys work)</p>
            <TabsDemo />
          </div>
          <div className="flex items-center gap-3">
            <Tooltip content="Add to your watchlist">
              <Button variant="outline" size="icon" aria-label="Add to watchlist">
                <Star aria-hidden="true" />
              </Button>
            </Tooltip>
            <span className="text-body-sm text-muted">Hover or focus the button.</span>
          </div>
        </div>
      </Section>

      <Section
        index={6}
        title="Controls"
        description="The pieces the Markets table is built from."
      >
        <ControlsDemo />
      </Section>

      <Section
        index={7}
        title="Data display"
        description="Sparklines are one neutral color; logos fall back to a letter; the live label says whether refreshes are working."
      >
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-4">
            <p className="label-mono text-muted">Sparkline: up, down, flat, empty</p>
            <div className="grid grid-cols-2 gap-4">
              <Sparkline data={UP} />
              <Sparkline data={DOWN} />
              <Sparkline data={[5, 5, 5, 5]} />
              <Sparkline data={[]} />
            </div>
          </div>
          <div className="space-y-4">
            <p className="label-mono text-muted">Coin logo and its fallback</p>
            <div className="flex items-center gap-4">
              <CoinLogo
                src="https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png"
                name="Bitcoin"
                size={40}
              />
              <CoinLogo src={null} name="Pelago" size={40} />
              <CoinLogo src={null} name="Solana" size={28} />
            </div>
          </div>
          <div className="space-y-4">
            <p className="label-mono text-muted">Live label and count-up</p>
            <div className="space-y-2">
              <LiveBadge />
              <LiveBadge status="offline" />
            </div>
            <p className="text-heading-md text-primary">
              <CountUp value={1234567} format="integer" />
            </p>
          </div>
        </div>
        <div className="max-w-md">
          <LiveDataCheck />
        </div>
      </Section>

      <Section
        index={8}
        title="Rows"
        description="Lists are hairline-separated rows with a mono index, not cards. Hover is a subtle overlay."
      >
        <ul className="border-t border-primary">
          {["Bitcoin", "Ethereum", "Solana"].map((name, i) => (
            <li
              key={name}
              className="flex h-20 items-center gap-6 border-b border-primary px-2 transition-colors duration-150 ease-standard hover:bg-overlay-hover"
            >
              <RowIndex n={i + 1} />
              <span className="text-body-lg text-primary">{name}</span>
              <span className="ml-auto num text-mono-md text-secondary">$67,432.10</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        index={9}
        title="Loading, empty and error states"
        description="Skeletons are sized to the content they replace, so nothing shifts when data arrives."
      >
        <div className="grid gap-8 lg:grid-cols-3">
          <Card
            className="space-y-4"
            aria-busy="true"
            role="status"
            aria-label="Loading example"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-24 w-full" />
          </Card>
          <Card padding="none">
            <EmptyState
              title="Your watchlist is empty"
              description="Star an asset anywhere in the app and it will show up here."
              action={
                <Button variant="outline" size="sm">
                  Browse markets
                </Button>
              }
            />
          </Card>
          <Card padding="none">
            <ErrorDemo />
          </Card>
        </div>
      </Section>
    </div>
  );
}
