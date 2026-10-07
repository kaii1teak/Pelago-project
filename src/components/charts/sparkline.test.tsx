import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./sparkline";

describe("Sparkline", () => {
  it("draws a single line for the data and hides itself from assistive tech", () => {
    const { container } = render(<Sparkline data={[1, 3, 2, 5]} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    const paths = svg.querySelectorAll("path");
    expect(paths).toHaveLength(1);
    expect(paths[0]!.getAttribute("d")).toMatch(/^M[\d. ]+( L[\d. ]+)+$/);
  });

  it("is monochrome: the same neutral color whether the series rises or falls", () => {
    const up = render(<Sparkline data={[1, 2, 3]} />).container.querySelector("svg");
    const down = render(<Sparkline data={[3, 2, 1]} />).container.querySelector("svg");
    expect(up).toHaveClass("text-secondary");
    expect(down).toHaveClass("text-secondary");
    // Green/red are reserved for the % change beside it.
    expect(up).not.toHaveClass("text-success");
    expect(down).not.toHaveClass("text-critical");
  });

  it("has no gradient fill or other decoration", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />);
    expect(container.querySelector("linearGradient")).toBeNull();
    expect(container.querySelector("defs")).toBeNull();
    expect(container.querySelector("path")).toHaveAttribute("fill", "none");
  });

  it("keeps a 1px stroke at any size", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />);
    const path = container.querySelector("path")!;
    expect(path).toHaveClass("stroke-1");
    expect(path).toHaveAttribute("vector-effect", "non-scaling-stroke");
  });

  it("keeps its box and shows a dashed baseline when there's no usable data", () => {
    const { container } = render(<Sparkline data={[]} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveClass("h-8");
    expect(container.querySelector("line")).toHaveAttribute("stroke-dasharray");
    expect(container.querySelector("path")).toBeNull();
  });

  it("lets the caller size it", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} className="h-12 w-32" />);
    expect(container.querySelector("svg")).toHaveClass("h-12", "w-32");
  });
});
