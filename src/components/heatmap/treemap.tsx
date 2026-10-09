"use client";

import { AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { NAV_FORWARD } from "@/components/motion/view-transition";
import { setSubject } from "@/lib/shared-subject";
import {
  PERIOD_WORDS,
  SIZE_LABEL,
  buildTreemap,
  neighborOf,
  type Direction,
  type HeatCoin,
  type HeatPeriod,
  type HeatSize,
} from "@/lib/heatmap";
import { cn } from "@/lib/utils";
import { HeatCell, type CellHandlers } from "./heat-cell";
import { HeatTip } from "./heat-tip";

const ARROWS: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

/** How long after the last size change the window counts as no longer being resized. */
const RESIZE_SETTLE_MS = 150;

type Box = { w: number; h: number };

/**
 * The market as one picture: a cell per asset, area for size, color for how far it moved.
 *
 * It lays itself out in whatever size the frame is given (CSS decides the height, see
 * "Heatmap" in globals.css), so a resize relays it. The cells are SVG, because they have to
 * be links you can Tab to, and the Tab key must not walk through two hundred of them: the
 * picture is ONE tab stop (the "roving" cell) and the arrow keys move between cells, to the
 * nearest one in that direction. Home and End jump to the first and last.
 *
 * Details for the eyes live in a tooltip (pointer, focus); the same facts are every cell's
 * accessible name. On touch a first tap pins the tooltip, with a button to open the asset,
 * and only a second tap on the same cell opens it: a tap can't hover.
 */
export function Treemap({
  coins,
  period,
  size,
  universe,
  density = "full",
  tall,
  busy = false,
  label,
}: {
  /** In rank order; the first `universe` are drawn. */
  coins: readonly HeatCoin[];
  period: HeatPeriod;
  size: HeatSize;
  universe: number;
  density?: "full" | "compact";
  /** Height / width of the frame on a phone (see .heat-frame). */
  tall?: number;
  /** The numbers on screen are the previous ones, and new ones are on their way. */
  busy?: boolean;
  /** Accessible name of the picture. */
  label?: string;
}) {
  const router = useRouter();
  const hintId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const cells = useRef(new Map<string, Pick<HTMLElement, "focus">>());
  const pointer = useRef<string>("mouse");

  const [box, setBox] = useState<Box | null>(null);
  const [roving, setRoving] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  // Follow the frame's size. A change of WIDTH is the window being dragged: the cells then
  // snap to the new layout instead of lagging behind the edge (see data-resizing in the CSS).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let timer: number | undefined;
    let width: number | null = null;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const next = {
        w: Math.round(entry.contentRect.width),
        h: Math.round(entry.contentRect.height),
      };
      if (width !== null && next.w !== width) {
        frame.dataset.resizing = "";
        window.clearTimeout(timer);
        timer = window.setTimeout(() => delete frame.dataset.resizing, RESIZE_SETTLE_MS);
      }
      width = next.w;
      setBox((previous) =>
        previous && previous.w === next.w && previous.h === next.h ? previous : next,
      );
    });
    observer.observe(frame);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const layout = useMemo(
    () =>
      box && box.w > 0 && box.h > 0
        ? buildTreemap(coins, { width: box.w, height: box.h, size, universe })
        : { tiles: [], skipped: 0 },
    [coins, box, size, universe],
  );
  const { tiles } = layout;

  const tabId =
    tiles.find((tile) => tile.coin.id === roving)?.coin.id ?? tiles[0]?.coin.id ?? null;

  const tipId = hover?.id ?? pinned ?? focused;
  const tipTile = tipId ? tiles.find((tile) => tile.coin.id === tipId) : undefined;

  // A tap away from the pinned tooltip puts it away.
  useEffect(() => {
    if (!pinned) return;
    const away = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest?.("[data-heat-id], [data-heat-tip]"))
        setPinned(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [pinned]);

  const open = useCallback(
    (coin: HeatCoin) => {
      setSubject({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        image: coin.image,
        price: coin.price,
      });
      router.push(`/coin/${coin.id}`, { transitionTypes: [NAV_FORWARD] });
    },
    [router],
  );

  // The handlers are made once (so the cells they are given don't re-render); this is how
  // they read which cell is pinned right now.
  const pinnedRef = useRef(pinned);
  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  const handlers = useMemo<CellHandlers>(
    () => ({
      activate(event, coin) {
        // Let the browser do its own thing with a modified click (new tab, new window, download).
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        // On touch the first tap shows what the cell is; the second opens it.
        if (pointer.current === "touch" && pinnedRef.current !== coin.id) {
          setPinned(coin.id);
          return;
        }
        open(coin);
      },
      hover(id, clientX, clientY) {
        if (id === null) return setHover(null);
        const rect = frameRef.current?.getBoundingClientRect();
        if (!rect) return;
        setHover({ id, x: clientX - rect.left, y: clientY - rect.top });
      },
      focus(id, visible) {
        setRoving(id);
        // Keyboard focus shows the details; a click's does not (the pointer shows them).
        setFocused(visible || pointer.current === "keyboard" ? id : null);
      },
      blur(id) {
        setFocused((current) => (current === id ? null : current));
      },
      register(id, element) {
        if (element) cells.current.set(id, element);
        else cells.current.delete(id);
      },
    }),
    [open],
  );
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      pointer.current = "keyboard";
      // A chord is the browser's (Ctrl+Enter opens a link in a new tab).
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const from = (event.target as Element)
        .closest?.("[data-heat-id]")
        ?.getAttribute("data-heat-id");
      if (!from) return;

      if (event.key === "Enter") {
        // Said here, not left to the link's own Enter: it must work the same everywhere.
        const coin = tiles.find((tile) => tile.coin.id === from)?.coin;
        if (coin) {
          event.preventDefault();
          open(coin);
        }
        return;
      }

      let to: string | null = null;
      const direction = ARROWS[event.key];
      if (direction) to = neighborOf(tiles, from, direction);
      else if (event.key === "Home") to = tiles[0]?.coin.id ?? null;
      else if (event.key === "End") to = tiles.at(-1)?.coin.id ?? null;
      else return;

      event.preventDefault();
      if (to && to !== from) cells.current.get(to)?.focus();
    },
    [tiles, open],
  );

  const frame = box ?? { w: 0, h: 0 };
  const hint =
    "Use the arrow keys to move between assets, Home and End to jump to the first and the last, and Enter to open one.";
  const summary =
    label ??
    `Market heatmap of ${tiles.length} assets. Area shows ${SIZE_LABEL[size].toLowerCase()}, color shows price change over ${PERIOD_WORDS[period]}.`;

  return (
    <div className="heat-box">
      <div
        ref={frameRef}
        data-density={density}
        aria-busy={busy || undefined}
        style={tall ? ({ "--heat-tall": tall } as React.CSSProperties) : undefined}
        className={cn(
          "heat-frame relative transition-opacity duration-base ease-standard",
          busy && "opacity-60",
        )}
      >
        {box && tiles.length > 0 && (
          <svg
            role="group"
            aria-label={summary}
            aria-describedby={hintId}
            width={box.w}
            height={box.h}
            viewBox={`0 0 ${box.w} ${box.h}`}
            className="absolute inset-0 block"
            onKeyDown={onKeyDown}
            onPointerDown={(event) => {
              pointer.current = event.pointerType;
            }}
          >
            <AnimatePresence initial={false}>
              {tiles.map((tile) => (
                <HeatCell
                  key={tile.coin.id}
                  coin={tile.coin}
                  x={tile.x}
                  y={tile.y}
                  w={tile.w}
                  h={tile.h}
                  period={period}
                  tabbable={tile.coin.id === tabId}
                  handlers={handlers}
                />
              ))}
            </AnimatePresence>
          </svg>
        )}

        {tipTile && (
          <HeatTip
            // Remounted per cell: its position is set on the element, from its own size.
            key={tipTile.coin.id}
            coin={tipTile.coin}
            period={period}
            anchor={
              hover?.id === tipTile.coin.id
                ? hover
                : { x: tipTile.x + tipTile.w / 2, y: tipTile.y + tipTile.h / 2 }
            }
            frame={frame}
            interactive={pinned === tipTile.coin.id && hover === null}
          />
        )}
      </div>
      {density === "full" && layout.skipped > 0 && (
        <p className="mt-3 text-body-sm text-muted">
          {layout.skipped} {layout.skipped === 1 ? "asset isn't" : "assets aren't"} shown:
          no {size === "cap" ? "market cap" : "volume"} figure, or too small to see.
        </p>
      )}
      <p id={hintId} className="sr-only">
        {hint}
      </p>
    </div>
  );
}
