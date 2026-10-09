import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HEAT_PERIODS } from "@/lib/heatmap";
import { HeatmapLegend } from "./heatmap-legend";

describe("HeatmapLegend", () => {
  it("names what color and area mean", () => {
    render(<HeatmapLegend period="7d" size="volume" />);
    expect(
      screen.getByText("Color is the price change over 7 days. Area is 24h volume."),
    ).toBeInTheDocument();
  });

  it("is seven steps from down a lot to up a lot, each described in words", () => {
    render(<HeatmapLegend period="24h" size="cap" />);
    const steps = within(screen.getByRole("list", { name: "Color scale" })).getAllByRole(
      "listitem",
    );
    expect(steps.map((s) => s.textContent)).toEqual([
      "down more than 6%",
      "down 3% to 6%",
      "down 1% to 3%",
      "within 1% either way",
      "up 1% to 3%",
      "up 3% to 6%",
      "up more than 6%",
    ]);
  });

  it("writes the percentages where one step becomes the next", () => {
    render(<HeatmapLegend period="24h" size="cap" />);
    for (const edge of ["−6%", "−3%", "−1%", "+1%", "+3%", "+6%"]) {
      expect(screen.getByText(edge)).toBeInTheDocument();
    }
  });

  it("has a scale of its own for each period, since a big week is not a big hour", () => {
    const edges = HEAT_PERIODS.map((period) => {
      const { container, unmount } = render(<HeatmapLegend period={period} size="cap" />);
      const text = [...container.querySelectorAll("[aria-hidden] span")].map(
        (s) => s.textContent,
      );
      unmount();
      return text.join(" ");
    });
    expect(new Set(edges).size).toBe(3);
  });

  it("fills the swatches from the heat tokens, not from colors of its own", () => {
    render(<HeatmapLegend period="24h" size="cap" />);
    const fills = within(screen.getByRole("list", { name: "Color scale" }))
      .getAllByRole("listitem")
      .map((li) => li.style.backgroundColor);
    expect(fills).toEqual([
      "var(--heat-down-3)",
      "var(--heat-down-2)",
      "var(--heat-down-1)",
      "var(--heat-flat)",
      "var(--heat-up-1)",
      "var(--heat-up-2)",
      "var(--heat-up-3)",
    ]);
  });
});
