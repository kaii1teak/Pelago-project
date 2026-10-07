import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PercentChange } from "./percent-change";

describe("PercentChange", () => {
  it("shows a gain with sign, and says 'up' to screen readers", () => {
    const { container } = render(<PercentChange value={4.216} />);
    expect(screen.getByText("+4.22%")).toBeInTheDocument();
    expect(screen.getByText("up")).toHaveClass("sr-only");
    expect(container.firstChild).toHaveClass("text-success");
  });

  it("shows a loss with sign, and says 'down'", () => {
    const { container } = render(<PercentChange value={-3.07} />);
    expect(screen.getByText("-3.07%")).toBeInTheDocument();
    expect(screen.getByText("down")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-critical");
  });

  it("treats a value that rounds to zero as unchanged, not a tiny gain", () => {
    const { container } = render(<PercentChange value={0.001} />);
    expect(screen.getByText("0.00%")).toBeInTheDocument();
    expect(screen.getByText("unchanged")).toBeInTheDocument();
    expect(container.firstChild).not.toHaveClass("text-success");
    expect(container.firstChild).not.toHaveClass("text-critical");
  });

  it("renders a labelled dash for missing data", () => {
    render(<PercentChange value={null} />);
    expect(screen.getByText("no data")).toBeInTheDocument();
  });

  it("keeps the decorative arrow out of the accessibility tree", () => {
    const { container } = render(<PercentChange value={1} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("can hide the arrow", () => {
    const { container } = render(<PercentChange value={1} showIcon={false} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
