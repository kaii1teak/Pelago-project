import { PercentChange } from "@/components/ui/percent-change";
import { Price } from "@/components/ui/price";
import { SectionLabel } from "@/components/ui/section-label";
import type { CoinDetail } from "@/lib/api/schemas";
import { formatCompactNumber, formatDate } from "@/lib/format";
import { RangeBar } from "./range-bar";

function Row({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-14 items-center justify-between gap-6 border-b border-primary px-2 py-3 ${className ?? ""}`}
    >
      <dt className="label-mono text-muted">{label}</dt>
      <dd className="text-right num text-mono-md text-primary">{children}</dd>
    </div>
  );
}

const NONE = <span className="text-muted">—</span>;

function Supply({ value, symbol }: { value: number | null; symbol: string }) {
  if (value == null) return NONE;
  return (
    <>
      {formatCompactNumber(value)} <span className="text-muted">{symbol}</span>
    </>
  );
}

export function KeyStats({ coin }: { coin: CoinDetail }) {
  const m = coin.market;
  const performance = [
    ["24h", m.change24h],
    ["7d", m.change7d],
    ["30d", m.change30d],
    ["1y", m.change1y],
  ] as const;

  return (
    <section aria-labelledby="stats-heading" className="space-y-8">
      <div className="space-y-4">
        <SectionLabel>Key stats</SectionLabel>
        <h2 id="stats-heading" className="text-heading-md text-primary">
          {coin.name} by the numbers
        </h2>
      </div>

      <dl className="grid border-t border-primary md:grid-cols-2 md:gap-x-16">
        <Row label="Market cap">
          <Price value={m.marketCap} compact />
        </Row>
        <Row label="Fully diluted">
          <Price value={m.fdv} compact />
        </Row>
        <Row label="24h volume">
          <Price value={m.volume24h} compact />
        </Row>
        <Row label="Circulating supply">
          <Supply value={m.circulatingSupply} symbol={coin.symbol} />
        </Row>
        <Row label="Total supply">
          <Supply value={m.totalSupply} symbol={coin.symbol} />
        </Row>
        <Row label="Max supply">
          <Supply value={m.maxSupply} symbol={coin.symbol} />
        </Row>

        {/* A <dl> group may only hold dt/dd, so the bar is a second dd of the same term. */}
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 border-b border-primary px-2 py-4 md:col-span-2">
          <dt className="label-mono text-muted">24h range</dt>
          <dd className="flex justify-end gap-3 num text-mono-md text-primary">
            <Price value={m.low24h} />
            <span className="text-muted">–</span>
            <Price value={m.high24h} />
          </dd>
          <dd className="col-span-2">
            <RangeBar low={m.low24h} high={m.high24h} value={m.price} />
          </dd>
        </div>

        <Row label="All-time high">
          <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            <Price value={m.ath} />
            <PercentChange value={m.athChange} className="text-mono-sm" />
            <span className="text-muted">{formatDate(m.athDate)}</span>
          </span>
        </Row>
        <Row label="All-time low">
          <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            <Price value={m.atl} />
            <PercentChange value={m.atlChange} className="text-mono-sm" />
            <span className="text-muted">{formatDate(m.atlDate)}</span>
          </span>
        </Row>

        <div className="border-b border-primary px-2 py-4 md:col-span-2">
          <dt className="mb-3 label-mono text-muted">Price change</dt>
          <dd className="flex flex-wrap gap-x-8 gap-y-3">
            {performance.map(([label, value]) => (
              <span key={label} className="flex items-center gap-2">
                <span className="num text-mono-sm text-muted">{label}</span>
                <PercentChange value={value} className="text-mono-sm" />
              </span>
            ))}
          </dd>
        </div>

        {coin.genesisDate && <Row label="Launched">{formatDate(coin.genesisDate)}</Row>}
      </dl>
    </section>
  );
}
