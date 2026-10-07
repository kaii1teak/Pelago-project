/**
 * Number/date formatting. The locale and time zone are pinned on purpose:
 * formatting with the runtime default differs between the Node server and the
 * user's browser and causes hydration mismatches.
 */

const LOCALE = "en-US";
const EMPTY = "—";

const isNum = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

// Intl formatters are expensive to construct; build each one once.
const usd = (min: number, max: number) =>
  new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
const usdByDigits = new Map<number, Intl.NumberFormat>();
function usdFormatter(digits: number) {
  let f = usdByDigits.get(digits);
  if (!f) usdByDigits.set(digits, (f = usd(digits, digits)));
  return f;
}

const compactUsd = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  notation: "compact",
  // Currency style pads to 2 decimals by default ("$84.20B", "$950.00K").
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const compactNumber = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  maximumFractionDigits: 2,
});
const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Fraction digits for a USD price: cheap coins need more precision to be meaningful. */
export function priceDigits(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1) return 2;
  if (abs >= 0.01) return 4;
  if (abs >= 0.0001) return 6;
  return 8;
}

/** $67,432.12, $0.4521, $0.00001234 */
export function formatUsd(value: number | null | undefined) {
  if (!isNum(value)) return EMPTY;
  return usdFormatter(priceDigits(value)).format(value);
}

/** $2.41T, $84.2B: for market cap and volume. */
export function formatCompactUsd(value: number | null | undefined) {
  if (!isNum(value)) return EMPTY;
  return compactUsd.format(value);
}

export function formatCompactNumber(value: number | null | undefined) {
  if (!isNum(value)) return EMPTY;
  return compactNumber.format(value);
}

export function formatInteger(value: number | null | undefined) {
  if (!isNum(value)) return EMPTY;
  return integer.format(value);
}

/** Always-signed percentage: +1.23%, -0.50%, 0.00%. */
export function formatPercent(value: number | null | undefined, digits = 2) {
  if (!isNum(value)) return EMPTY;
  const fixed = value.toFixed(digits);
  // Avoid "-0.00%": a value that rounds to zero has no direction.
  if (Number(fixed) === 0) return `${(0).toFixed(digits)}%`;
  return `${value > 0 ? "+" : ""}${fixed}%`;
}

/** Unsigned percentage, e.g. dominance: 52.4% */
export function formatPlainPercent(value: number | null | undefined, digits = 1) {
  if (!isNum(value)) return EMPTY;
  return `${value.toFixed(digits)}%`;
}

export function formatDate(value: string | number | Date | null | undefined) {
  if (value == null) return EMPTY;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? EMPTY : dateFormatter.format(date);
}

export type Direction = "up" | "down" | "flat";

/** Direction of a change after rounding, so "+0.00%" is never shown as up. */
export function directionOf(value: number | null | undefined, digits = 2): Direction {
  if (!isNum(value)) return "flat";
  const rounded = Number(value.toFixed(digits));
  if (rounded > 0) return "up";
  if (rounded < 0) return "down";
  return "flat";
}
