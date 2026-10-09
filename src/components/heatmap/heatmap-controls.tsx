"use client";

import { CategoryChips } from "@/components/ui/category-chips";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  HEAT_PERIODS,
  HEAT_SIZES,
  HEAT_UNIVERSES,
  PERIOD_LABEL,
  SIZE_LABEL,
  type HeatPeriod,
  type HeatSize,
  type HeatUniverse,
} from "@/lib/heatmap";

const PERIOD_OPTIONS = HEAT_PERIODS.map((value) => ({
  value,
  label: PERIOD_LABEL[value],
}));
const UNIVERSE_OPTIONS = HEAT_UNIVERSES.map((value) => ({
  value: String(value),
  label: `Top ${value}`,
}));
const SIZE_OPTIONS = HEAT_SIZES.map((value) => ({ value, label: SIZE_LABEL[value] }));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {/* The same words name the group for assistive technology (the control's aria-label). */}
      <p aria-hidden="true" className="label-mono text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

/** Period, how many assets, what the area means, and the category. */
export function HeatmapControls({
  period,
  top,
  size,
  category,
  onPeriodChange,
  onTopChange,
  onSizeChange,
  onCategoryChange,
}: {
  period: HeatPeriod;
  top: HeatUniverse;
  size: HeatSize;
  category: string | null;
  onPeriodChange: (period: HeatPeriod) => void;
  onTopChange: (top: HeatUniverse) => void;
  onSizeChange: (size: HeatSize) => void;
  onCategoryChange: (category: string | null) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
        <Field label="Color by change">
          <SegmentedControl
            label="Color by change"
            value={period}
            onValueChange={onPeriodChange}
            options={PERIOD_OPTIONS}
          />
        </Field>
        <Field label="Assets">
          <SegmentedControl
            label="Assets"
            value={String(top)}
            onValueChange={(value) => onTopChange(Number(value) as HeatUniverse)}
            options={UNIVERSE_OPTIONS}
          />
        </Field>
        <Field label="Size by">
          <SegmentedControl
            label="Size by"
            value={size}
            onValueChange={onSizeChange}
            options={SIZE_OPTIONS}
          />
        </Field>
      </div>
      <CategoryChips category={category} onCategoryChange={onCategoryChange} />
    </div>
  );
}
