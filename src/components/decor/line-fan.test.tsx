import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FOOTER_FAN, HERO_FAN, buildLineFan } from "@/lib/line-fan";
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
    const { sides, rays } = buildLineFan(HERO_FAN);
    expect(container.querySelectorAll("path")).toHaveLength(sides.length + rays.length);
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

  it("gives each fan on the page its own gradient, so two never share an id", () => {
    const { container } = render(
      <>
        <LineFan fan={HERO_FAN} />
        <LineFan fan={FOOTER_FAN} />
      </>,
    );
    const ids = [...container.querySelectorAll("linearGradient")].map((g) => g.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    // ...and every ray points at a gradient that exists.
    for (const path of container.querySelectorAll("path[stroke^='url(']")) {
      const id = path.getAttribute("stroke")!.slice(5, -1);
      expect(ids).toContain(id);
    }
  });

  it("omits the gradient when there are no rays", () => {
    const { container } = render(<LineFan fan={{ ...HERO_FAN, rayLines: 0 }} />);
    expect(container.querySelector("linearGradient")).toBeNull();
  });

  it("globals.css keeps the strokes hairline whatever the box is stretched to", () => {
    const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\.line-fan path\s*\{[^}]*vector-effect:\s*non-scaling-stroke/);
  });
});
