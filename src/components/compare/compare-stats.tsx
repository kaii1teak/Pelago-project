import Link from "next/link";
import { CoinLogo } from "@/components/ui/coin-logo";
import { PercentChange } from "@/components/ui/percent-change";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketCoin } from "@/lib/api/schemas";
import { RANGE_NAME, type ChartRange } from "@/lib/chart";
import { formatCompactNumber } from "@/lib/format";
import { Swatch } from "./color-picker";

export type StatsAsset = {
  id: string;
  color: number;
  name: string;
  image: string | null;
  /** Undefined until the market data arrives (or if the API has no such coin). */
  coin: MarketCoin | undefined;
  /** Percent change over the selected range, from the chart. */
  change: number | null;
  /** Whether the market data is still on its way. */
  loading: boolean;
};

type Row = {
  id: string;
  label: (range: ChartRange) => string;
  cell: (asset: StatsAsset & { coin: MarketCoin }) => React.ReactNode;
  /** Shown instead of the market cell for the range row, which needs no market data. */
  own?: (asset: StatsAsset) => React.ReactNode;
};

const num = "num text-mono-md text-primary";

const ROWS: readonly Row[] = [
  {
    id: "range",
    label: (range) => `On the chart, ${RANGE_NAME[range]}`,
    cell: (a) => <PercentChange value={a.change} className="text-mono-sm" />,
    own: (a) => <PercentChange value={a.change} className="text-mono-sm" />,
  },
  {
    id: "price",
    label: () => "Price",
    cell: (a) => <Price value={a.coin.price} className={num} />,
  },
  {
    id: "change24h",
    label: () => "Change, 24 hours",
    cell: (a) => <PercentChange value={a.coin.change24h} className="text-mono-sm" />,
  },
  {
    id: "change7d",
    label: () => "Change, 7 days",
    cell: (a) => <PercentChange value={a.coin.change7d} className="text-mono-sm" />,
  },
  {
    id: "marketCap",
    label: () => "Market cap",
    cell: (a) => <Price value={a.coin.marketCap} compact className={num} />,
  },
  {
    id: "rank",
    label: () => "Rank",
    cell: (a) => <span className={num}>{a.coin.rank ? `#${a.coin.rank}` : "—"}</span>,
  },
  {
    id: "volume",
    label: () => "Volume, 24 hours",
    cell: (a) => <Price value={a.coin.volume24h} compact className={num} />,
  },
  {
    id: "high24h",
    label: () => "24h high",
    cell: (a) => <Price value={a.coin.high24h} className={num} />,
  },
  {
    id: "low24h",
    label: () => "24h low",
    cell: (a) => <Price value={a.coin.low24h} className={num} />,
  },
  {
    id: "supply",
    label: () => "Circulating supply",
    cell: (a) => (
      <span className={num}>
        {formatCompactNumber(a.coin.circulatingSupply)}{" "}
        <span className="text-muted">{a.coin.symbol}</span>
      </span>
    ),
  },
];

/**
 * The compared assets side by side: one column per asset, one row per figure.
 * It is also the accessible twin of the chart, which is a picture to a screen
 * reader: every number the chart implies is here as text.
 */
export function CompareStats({
  assets,
  range,
}: {
  assets: readonly StatsAsset[];
  range: ChartRange;
}) {
  // `relative` matters: without it the absolutely positioned screen-reader text inside
  // the cells escapes this scroller and widens the whole page on phones.
  return (
    <div className="relative overflow-x-auto border-t border-primary">
      <table className="w-full min-w-[34rem] border-collapse">
        <caption className="sr-only">
          Key figures for the compared assets, one column per asset.
        </caption>
        <thead className="border-b border-strong">
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 w-28 bg-primary py-4 pl-2 text-left md:w-48"
            >
              <span className="sr-only">Figure</span>
            </th>
            {assets.map((asset) => (
              <th key={asset.id} scope="col" className="px-3 py-4 text-left font-normal">
                <Link
                  href={`/coin/${asset.id}`}
                  className="flex min-w-0 items-center gap-2 rounded-control py-1 transition-colors duration-150 ease-standard hover:text-secondary"
                >
                  <Swatch color={asset.color} className="h-5 w-1 shrink-0" />
                  <CoinLogo src={asset.image} name={asset.name} size={24} />
                  <span className="truncate text-body-md text-primary">{asset.name}</span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.id} className="h-14 border-b border-primary">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-primary py-2 pl-2 text-left label-mono font-normal text-muted"
              >
                {row.label(range)}
              </th>
              {assets.map((asset) => (
                <td key={asset.id} className="px-3">
                  {asset.coin ? (
                    row.cell({ ...asset, coin: asset.coin })
                  ) : row.own ? (
                    row.own(asset)
                  ) : asset.loading ? (
                    <Skeleton className="h-5 w-20" />
                  ) : (
                    <span className="text-muted">
                      —<span className="sr-only">unavailable</span>
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
