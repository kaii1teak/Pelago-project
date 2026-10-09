"use client";

import { motion, useIsPresent } from "motion/react";
import { memo, useMemo } from "react";
import { useFlash } from "@/components/live/flash";
import { useLiveCoin } from "@/hooks/use-live";
import { formatPercent, formatUsd } from "@/lib/format";
import {
  LABEL_PAD,
  cellName,
  changeFor,
  heatFill,
  heatStep,
  planLabel,
  secondarySize,
  type HeatCoin,
  type HeatPeriod,
} from "@/lib/heatmap";
import { DURATION, EASE_STANDARD, entering } from "@/lib/motion";

export type CellHandlers = {
  /** A click, or Enter, on a cell. */
  activate: (event: React.MouseEvent, coin: HeatCoin) => void;
  /** The pointer is over a cell (or has left every cell: id null). Mouse and pen only. */
  hover: (id: string | null, clientX: number, clientY: number) => void;
  /** A cell took focus; `visible` = it should look focused (the keyboard put it there). */
  focus: (id: string, visible: boolean) => void;
  blur: (id: string) => void;
  /** Lets the treemap move focus between cells. */
  register: (id: string, element: Pick<HTMLElement, "focus"> | null) => void;
};

/** Whether focus should be drawn: the keyboard put it here, not a click. (Old engines lack the selector: draw it.) */
function looksFocused(element: Element) {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * One asset in the treemap: a rectangle filled by how far its price moved, labelled as far
 * as it has room to, and a link to the asset's page. Its place and size are plain numbers
 * from the layout; CSS (see "Heatmap" in globals.css) slides and grows it when they change.
 * The price is the live one when there is one, so the fill follows the market and each tick
 * flashes a layer over the cell. Memoised: a cell re-renders for its own tick, its own
 * numbers, or a move of the layout, never because the pointer went over another cell.
 */
export const HeatCell = memo(function HeatCell({
  coin,
  x,
  y,
  w,
  h,
  period,
  tabbable,
  handlers,
}: {
  coin: HeatCoin;
  x: number;
  y: number;
  w: number;
  h: number;
  period: HeatPeriod;
  /** The one cell the Tab key lands on (arrow keys move between the others). */
  tabbable: boolean;
  handlers: CellHandlers;
}) {
  const present = useIsPresent();
  const live = useLiveCoin(coin);
  const change = period === "24h" ? live.change24h : changeFor(coin, period);
  const flashRef = useFlash<SVGRectElement>(live.price);

  // The label is planned on the polled numbers, which hold still for a minute: a live price
  // gaining a digit must not make the label jump between layouts.
  const plan = useMemo(
    () =>
      planLabel(w, h, {
        ticker: coin.symbol,
        change: formatPercent(changeFor(coin, period)),
        price: formatUsd(coin.price),
      }),
    [w, h, coin, period],
  );

  const text = {
    ticker: coin.symbol,
    change: formatPercent(change),
    price: formatUsd(live.price),
  };
  const inset = Math.max(0, w - 2);
  const insetH = Math.max(0, h - 2);

  return (
    <motion.g
      initial={entering({ opacity: 0 })}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_STANDARD }}
      // A cell on its way out can't be reached any more, by pointer or by Tab.
      style={present ? undefined : { pointerEvents: "none" }}
      aria-hidden={present ? undefined : true}
    >
      <g className="heat-cell" style={{ transform: `translate(${x}px, ${y}px)` }}>
        <a
          ref={(element) => handlers.register(coin.id, present ? element : null)}
          href={`/coin/${coin.id}`}
          role="link"
          className="heat-link"
          data-heat-id={coin.id}
          tabIndex={present && tabbable ? 0 : -1}
          aria-label={cellName(coin, period, live.price, change)}
          onClick={(event) => handlers.activate(event, coin)}
          onFocus={(event) => handlers.focus(coin.id, looksFocused(event.currentTarget))}
          onBlur={() => handlers.blur(coin.id)}
          onPointerEnter={(event) => {
            if (event.pointerType !== "touch")
              handlers.hover(coin.id, event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (event.pointerType !== "touch")
              handlers.hover(coin.id, event.clientX, event.clientY);
          }}
          onPointerLeave={() => handlers.hover(null, 0, 0)}
        >
          {/* The 1px stroke in the page color is the gap between cells. */}
          <rect
            className="heat-rect"
            width={w}
            height={h}
            style={{ fill: heatFill(heatStep(change, period)) }}
            stroke="var(--bg-primary)"
            strokeWidth={1}
          />
          <rect ref={flashRef} className="heat-flash" width={w} height={h} />
          <rect className="heat-hover" width={w} height={h} />
          {plan?.lines.map((line, index) => (
            <text
              key={line}
              className="heat-label"
              data-line={line}
              x={LABEL_PAD}
              y={plan.baselines[index]}
              fontSize={line === "ticker" ? plan.fontSize : secondarySize(plan.fontSize)}
            >
              {text[line]}
            </text>
          ))}
          <rect
            className="heat-ring heat-ring-outer"
            x={1}
            y={1}
            width={inset}
            height={insetH}
          />
          <rect
            className="heat-ring heat-ring-inner"
            x={1}
            y={1}
            width={inset}
            height={insetH}
          />
        </a>
      </g>
    </motion.g>
  );
});
