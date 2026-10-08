import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type PageItem = number | "ellipsis";

/**
 * Page numbers to show: always the first and last page, the current page, and
 * `siblings` on each side, with "ellipsis" standing in for any gap.
 * e.g. page 5 of 20 -> [1, "ellipsis", 4, 5, 6, "ellipsis", 20]
 */
export function getPageWindow(page: number, pageCount: number, siblings = 1): PageItem[] {
  const current = Math.min(Math.max(page, 1), pageCount);
  const keep = new Set<number>([1, pageCount]);
  for (let p = current - siblings; p <= current + siblings; p++) {
    if (p >= 1 && p <= pageCount) keep.add(p);
  }
  const sorted = [...keep].sort((a, b) => a - b);

  const items: PageItem[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined) {
      // A single missing page is cheaper to show than an ellipsis standing in for it.
      if (p - prev === 2) items.push(prev + 1);
      else if (p - prev > 2) items.push("ellipsis");
    }
    items.push(p);
  });
  return items;
}

const buttonClass =
  "inline-flex size-9 items-center justify-center rounded-control text-mono-md font-medium transition-colors duration-fast ease-standard disabled:pointer-events-none disabled:text-disabled";

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Pagination" className={className}>
      <ul className="flex items-center justify-center gap-1">
        <li>
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className={cn(
              buttonClass,
              "text-secondary hover:bg-overlay-hover hover:text-primary active:bg-overlay-pressed",
            )}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        </li>

        {getPageWindow(page, pageCount).map((item, i) => (
          <li key={item === "ellipsis" ? `gap-${i}` : item}>
            {item === "ellipsis" ? (
              <span
                aria-hidden="true"
                className="inline-flex size-9 items-center justify-center text-muted"
              >
                …
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPageChange(item)}
                className={cn(
                  buttonClass,
                  "num",
                  item === page
                    ? "bg-inverse text-inverse"
                    : "text-secondary hover:bg-overlay-hover hover:text-primary active:bg-overlay-pressed",
                )}
              >
                {item}
              </button>
            )}
          </li>
        ))}

        <li>
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            className={cn(
              buttonClass,
              "text-secondary hover:bg-overlay-hover hover:text-primary active:bg-overlay-pressed",
            )}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
