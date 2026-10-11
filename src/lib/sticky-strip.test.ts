import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The home page pins two things at the top (the header and its strip of prices), and the
 * pinned features panel below them has to be measured from both, or the strip would cover
 * its top. These read globals.css to keep those numbers in step.
 */
const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), "utf8");
const css = read("src/app/globals.css");
const features = read("src/components/home/features-section.tsx");
const ticker = read("src/components/live/ticker-tape.tsx");

const remOf = (property: string, within = css) =>
  Number(new RegExp(`${property}:\\s*([\\d.]+)rem`).exec(within)![1]);

describe("what the home page pins at the top", () => {
  it("is the header and the strip as it looks while stuck", () => {
    expect(css).toMatch(
      /--stuck-h:\s*calc\(var\(--header-h\) \+ var\(--strip-stuck-h\)\);/,
    );
  });

  it("looks, while stuck, as tall as the strip of the other pages (h-9)", () => {
    expect(remOf("--strip-stuck-h")).toBe(2.25);
    expect(ticker).toContain('const HEIGHT = "h-9"');
  });

  it("sticks higher by the difference in height, so its box never changes size", () => {
    expect(css).toMatch(
      /@utility top-home-strip \{\s*top: calc\(var\(--header-h\) \+ var\(--strip-stuck-h\) - var\(--strip-home-h\)\);/,
    );
  });

  it("is taller where it sits than where it sticks, on phones and wider screens", () => {
    const stuck = remOf("--strip-stuck-h");
    const phone = remOf("--strip-home-h");
    const wide = Number(/--strip-home-h:\s*([\d.]+)rem;\s*\}/.exec(css)![1]);
    expect(phone).toBeGreaterThan(stuck);
    expect(wide).toBeGreaterThan(phone);
  });

  it("measures the pinned features panel and its scroll track below both", () => {
    expect(css).toMatch(
      /@utility h-panel \{\s*height: calc\(100svh - var\(--stuck-h\)\);/,
    );
    expect(css).toMatch(
      /@utility feature-track \{\s*height: calc\(100svh - var\(--stuck-h\)/,
    );
    expect(css).toMatch(/@utility top-stuck \{\s*top: var\(--stuck-h\);/);
    expect(features).toContain("lg:top-stuck");
    expect(features).not.toContain("lg:top-header");
  });
});
