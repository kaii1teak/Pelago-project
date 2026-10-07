import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HERO_FAN, buildLineFan } from "@/lib/line-fan";
import { LineFan } from "./line-fan";

describe("LineFan", () => {
  it("is purely decorative: hidden from assistive tech and not focusable", () => {
    const { container } = render(<LineFan fan={HERO_FAN} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg.querySelector("a, button, [tabindex]")).toBeNull();
  });

  it("draws one path per line, and nothing animated", () => {
    const { container } = render(<LineFan fan={HERO_FAN} />);
    const { sides, rising } = buildLineFan(HERO_FAN);
    expect(container.querySelectorAll("path")).toHaveLength(sides.length + rising.length);
    expect(
      container.querySelector("animate, animateTransform, animateMotion, set"),
    ).toBeNull();
  });

  it("follows the theme through currentColor, with no hardcoded color", () => {
    const { container } = render(<LineFan fan={HERO_FAN} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });

  it("stretches over its box and keeps the hairline hook for the stroke rule", () => {
    const { container } = render(<LineFan fan={HERO_FAN} className="size-full" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("preserveAspectRatio", "none");
    expect(svg).toHaveClass("line-fan", "size-full");
  });

  it("draws every line in one ink and weight", () => {
    const { container } = render(<LineFan fan={HERO_FAN} />);
    // One stroke color and width for the whole svg: no per-path overrides, gradients or filters.
    expect(container.querySelector("defs, linearGradient, filter")).toBeNull();
    expect(container.querySelector("path[stroke], path[stroke-width]")).toBeNull();
    // ...and nothing is dimmed or tinted on a particular screen size.
    expect(container.querySelector("g")).toBeNull();
    expect(container.innerHTML).not.toMatch(/opacity-\d+/);
  });

  it("works without rising lines too", () => {
    const { container } = render(<LineFan fan={{ ...HERO_FAN, riseSpan: 0 }} />);
    expect(container.querySelectorAll("path")).toHaveLength(HERO_FAN.sideLines * 2);
  });

  it("globals.css keeps the strokes hairline whatever the box is stretched to", () => {
    const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.line-fan path\s*\{[^}]*vector-effect:\s*non-scaling-stroke/);
  });
});
