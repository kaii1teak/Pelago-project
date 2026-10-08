import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DURATION, EASE_STANDARD } from "./motion";
import { DURATION_NAMES, EASE_NAMES, cn } from "./utils";

const SRC = path.resolve(import.meta.dirname, "..");
const css = readFileSync(path.join(SRC, "app/globals.css"), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const cssMs = (name: string) => {
  const match = css.match(new RegExp(`--duration-${name}:\\s*(\\d+)ms`));
  expect(match, `--duration-${name} in globals.css`).not.toBeNull();
  return Number(match![1]);
};

describe("motion tokens", () => {
  it("the JS durations mirror the CSS ones", () => {
    for (const name of DURATION_NAMES) {
      expect(DURATION[name] * 1000, name).toBeCloseTo(cssMs(name), 5);
    }
  });

  it("the scale is 120 / 200 / 300 / 500 ms", () => {
    expect(DURATION_NAMES.map(cssMs)).toEqual([120, 200, 300, 500]);
  });

  it("the JS easing is the CSS --ease-standard", () => {
    const match = css.match(/--ease-standard:\s*cubic-bezier\(([^)]+)\)/);
    expect(match![1]!.split(",").map(Number)).toEqual([...EASE_STANDARD]);
  });

  it("every duration and easing token has its Tailwind utility", () => {
    for (const name of DURATION_NAMES)
      expect(css, name).toContain(
        `--transition-duration-${name}: var(--duration-${name})`,
      );
    for (const name of EASE_NAMES)
      expect(css, name).toMatch(new RegExp(`--ease-${name}:`));
  });

  it("tailwind-merge treats them as the conflicting classes they are", () => {
    expect(cn("duration-fast", "duration-slow")).toBe("duration-slow");
    expect(cn("ease-standard", "ease-spring")).toBe("ease-spring");
    expect(cn("duration-fast", "ease-spring")).toBe("duration-fast ease-spring");
  });
});

describe("no motion outside the tokens", () => {
  it("components use duration-fast/base/slow/slower, never a raw duration", () => {
    const offenders = sourceFiles(SRC).flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return [...text.matchAll(/\b(?:duration|delay)-(?:\d|\[)[^\s"'`]*/g)].map(
        (m) => `${path.relative(SRC, file)}: ${m[0]}`,
      );
    });
    expect(offenders).toEqual([]);
  });

  it("globals.css transitions and animations use tokens (loops and failsafes excepted)", () => {
    // Endless loops and a failsafe timer are not UI transitions: they have their own pace.
    const allowed = ["marquee 60s", "skeleton 1.6s", "2.5s forwards", "0.01ms"];
    const offenders = css
      .split("\n")
      .filter((line) => /(?:transition|animation)[a-z-]*:/.test(line))
      .filter((line) => /\b\d*\.?\d+m?s\b/.test(line))
      .filter((line) => !allowed.some((ok) => line.includes(ok)));
    expect(offenders).toEqual([]);
  });
});

describe("entering", () => {
  it("is the starting state, unless animations are skipped: then there is no starting state", async () => {
    const { MotionGlobalConfig } = await import("motion/react");
    const { entering } = await import("./motion");
    MotionGlobalConfig.skipAnimations = false;
    expect(entering({ opacity: 0 })).toEqual({ opacity: 0 });
    MotionGlobalConfig.skipAnimations = true;
    expect(entering({ opacity: 0 })).toBe(false);
  });
});
