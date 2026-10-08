import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortDir, SortKey } from "@/lib/markets-table";
import { cn } from "@/lib/utils";

/**
 * Sortable column header. The <th> carries `aria-sort` (what screen readers
 * announce), the inner <button> is what you click or tab to. The arrow slot is
 * always reserved, so hovering a header never shifts its neighbours.
 */
export function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "right",
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = activeKey === sortKey;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "px-3 py-3 font-normal",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "group -mx-1.5 inline-flex items-center gap-1 rounded-control px-1.5 py-1 label-mono transition-colors duration-fast ease-standard",
          align === "right" && "flex-row-reverse",
          active ? "text-primary" : "text-muted hover:text-primary",
        )}
      >
        {label}
        <Icon
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0 transition-opacity duration-fast ease-standard",
            active
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60",
          )}
        />
      </button>
    </th>
  );
}
