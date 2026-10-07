import type { MarketCoin } from "@/lib/api/schemas";
import type { SortDir, SortKey } from "@/lib/markets-table";
import { cn } from "@/lib/utils";
import { CoinRow } from "./coin-row";
import { SortHeader } from "./sort-header";

export function MarketsTable({
  rows,
  sort,
  dir,
  onSort,
  busy = false,
}: {
  rows: readonly MarketCoin[];
  sort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  /** Showing the previous results while a new filter loads. */
  busy?: boolean;
}) {
  const header = { activeKey: sort, dir, onSort } as const;

  return (
    <div
      className={cn(
        "overflow-x-auto transition-opacity duration-250 ease-standard",
        busy && "opacity-60",
      )}
      aria-busy={busy}
    >
      <table className="w-full min-w-[20rem] border-collapse">
        <caption className="sr-only">
          Cryptocurrencies by market cap. Column headers are buttons that sort the table.
        </caption>
        <thead className="border-b border-strong">
          <tr>
            <th scope="col" className="w-12 py-3 pl-2">
              <span className="sr-only">Watch</span>
            </th>
            <SortHeader
              label="#"
              sortKey="rank"
              align="left"
              className="hidden w-12 sm:table-cell"
              {...header}
            />
            <SortHeader label="Name" sortKey="name" align="left" {...header} />
            <SortHeader label="Price" sortKey="price" {...header} />
            <SortHeader
              label="1h"
              sortKey="change1h"
              className="hidden lg:table-cell"
              {...header}
            />
            <SortHeader label="24h" sortKey="change24h" {...header} />
            <SortHeader
              label="7d"
              sortKey="change7d"
              className="hidden md:table-cell"
              {...header}
            />
            <SortHeader
              label="Market cap"
              sortKey="marketCap"
              className="hidden md:table-cell"
              {...header}
            />
            <SortHeader
              label="Volume (24h)"
              sortKey="volume"
              className="hidden lg:table-cell"
              {...header}
            />
            <th
              scope="col"
              className="hidden w-44 px-3 py-3 text-right label-mono font-normal text-muted lg:table-cell"
            >
              Last 7 days
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((coin) => (
            <CoinRow key={coin.id} coin={coin} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
