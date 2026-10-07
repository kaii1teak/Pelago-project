import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./segmented-control";

const options = [
  { value: "all", label: "All" },
  { value: "up", label: "Gainers" },
] as const;

describe("SegmentedControl", () => {
  it("is a labelled group of toggle buttons, with the active one pressed", () => {
    render(
      <SegmentedControl
        label="Show"
        value="all"
        onValueChange={() => {}}
        options={options}
      />,
    );
    expect(screen.getByRole("group", { name: "Show" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Gainers" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reports a choice, and is fully keyboard operable", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        label="Show"
        value="all"
        onValueChange={onValueChange}
        options={options}
      />,
    );
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Gainers" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("up");
  });
});
