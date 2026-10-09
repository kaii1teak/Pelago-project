import {
  HEAT_BREAKS,
  PERIOD_WORDS,
  SIZE_LABEL,
  heatFill,
  stepWords,
  type HeatPeriod,
  type HeatSize,
  type HeatStep,
} from "@/lib/heatmap";
import { cn } from "@/lib/utils";

const STEPS: HeatStep[] = [-3, -2, -1, 0, 1, 2, 3];

const percent = (n: number, sign: "+" | "−") => `${sign}${n}%`;

/**
 * The key to the picture: seven swatches from "down a lot" through "flat" to "up a lot",
 * with the percentages where one becomes the next. Color is never the only carrier of a
 * cell's meaning (the cells say their percentage and have it in their name), but this is
 * how to read the colors. Each swatch is also described in words for screen readers.
 */
export function HeatmapLegend({
  period,
  size,
  className,
}: {
  period: HeatPeriod;
  size: HeatSize;
  className?: string;
}) {
  const [weak, medium, strong] = HEAT_BREAKS[period];
  // The edge between swatch i and i + 1, as it is written under the bar.
  const edges = [
    percent(strong, "−"),
    percent(medium, "−"),
    percent(weak, "−"),
    percent(weak, "+"),
    percent(medium, "+"),
    percent(strong, "+"),
  ];

  return (
    <figure className={cn("space-y-3", className)}>
      <figcaption className="text-body-md text-secondary">
        Color is the price change over {PERIOD_WORDS[period]}. Area is{" "}
        {SIZE_LABEL[size].toLowerCase()}.
      </figcaption>
      <div className="max-w-xl">
        <ol aria-label="Color scale" className="flex">
          {STEPS.map((step) => (
            <li
              key={step}
              className="h-4 flex-1 border-x border-primary first:border-l-0 last:border-r-0"
              style={{ backgroundColor: heatFill(step) }}
            >
              <span className="sr-only">{stepWords(step, period)}</span>
            </li>
          ))}
        </ol>
        <div aria-hidden="true" className="relative mt-1 h-4">
          {edges.map((edge, index) => (
            <span
              key={edge}
              className="absolute -translate-x-1/2 num text-mono-sm text-muted"
              style={{ left: `${((index + 1) / 7) * 100}%` }}
            >
              {edge}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
