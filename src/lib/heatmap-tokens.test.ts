import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HEAT_PERIODS, heatFill, type HeatStep } from "./heatmap";

/**
 * The heatmap's fills are CSS color-mix() expressions over the theme's colors, which no
 * test environment can evaluate. So this reads globals.css and does the same arithmetic,
 * to hold the one promise a color scale must keep: the label on top stays readable on
 * every step, in both themes. (The browser audit checks the real thing; this stops a
 * token edit from quietly breaking it.)
 */
const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");

type Rgb = [number, number, number];

function declarations(selector: string): Map<string, string> {
  const vars = new Map<string, string>();
  const block = new RegExp(
    `(?:^|\\n)${selector.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\n\\}`,
    "g",
  );
  for (const match of css.matchAll(block)) {
    for (const decl of match[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      vars.set(decl[1]!, decl[2]!.replace(/\s+/g, " ").trim());
    }
  }
  return vars;
}

const light = declarations(":root");
const dark = new Map([...light, ...declarations(".dark")]);

const hex = (value: string): Rgb => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

function resolve(name: string, vars: Map<string, string>): Rgb {
  const value = vars.get(name);
  if (!value) throw new Error(`${name} is not declared`);
  if (value.startsWith("#")) return hex(value);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  if (alias) return resolve(alias[1]!, vars);
  const mix =
    /^color-mix\(in srgb, var\((--[\w-]+)\) ([\d.]+)%, var\((--[\w-]+)\)\)$/.exec(value);
  if (mix) {
    const [a, b] = [resolve(mix[1]!, vars), resolve(mix[3]!, vars)];
    const p = Number(mix[2]) / 100;
    return a.map((v, i) => v * p + b[i]! * (1 - p)) as Rgb;
  }
  throw new Error(`cannot read ${name}: ${value}`);
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const STEPS: HeatStep[] = [-3, -2, -1, 0, 1, 2, 3];
const fillName = (step: HeatStep | null) => /var\((--[\w-]+)\)/.exec(heatFill(step))![1]!;

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("heatmap colors, %s theme", (_theme, vars) => {
  const text = resolve("--text-primary", vars);
  const page = resolve("--bg-primary", vars);

  it.each(STEPS)("keeps the label readable (4.5:1) on step %i", (step) => {
    expect(contrast(text, resolve(fillName(step), vars))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the label readable where there is no number", () => {
    expect(contrast(text, resolve(fillName(null), vars))).toBeGreaterThanOrEqual(4.5);
  });

  it("grows stronger away from flat, on both sides", () => {
    const distance = (step: HeatStep) => contrast(resolve(fillName(step), vars), page);
    expect(distance(2)).toBeGreaterThan(distance(1));
    expect(distance(3)).toBeGreaterThan(distance(2));
    expect(distance(-2)).toBeGreaterThan(distance(-1));
    expect(distance(-3)).toBeGreaterThan(distance(-2));
  });

  it("keeps neighbouring steps apart (a step you can't tell from the next is no step)", () => {
    for (let i = 0; i < STEPS.length - 1; i++) {
      const a = resolve(fillName(STEPS[i]!), vars);
      const b = resolve(fillName(STEPS[i + 1]!), vars);
      // Euclidean distance in sRGB: crude, but a step that rounds to the next fails it.
      const gap = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      expect(gap, `step ${STEPS[i]} vs ${STEPS[i + 1]}`).toBeGreaterThanOrEqual(10);
    }
  });

  it("tells rising from falling by hue, not only by strength", () => {
    const up = resolve(fillName(3), vars);
    const down = resolve(fillName(-3), vars);
    expect(up[1]).toBeGreaterThan(up[0]); // greener than red
    expect(down[0]).toBeGreaterThan(down[1]); // redder than green
  });
});

describe("the scale and its thresholds", () => {
  it("is defined for every period", () => {
    expect(HEAT_PERIODS).toHaveLength(3);
  });
});
