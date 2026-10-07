import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("titles itself with an h3 by default (it normally sits inside a section)", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByRole("heading", { level: 3, name: "Nothing here" })).toBeVisible();
  });

  it("can be an h2, for pages where it comes straight after the h1", () => {
    render(<EmptyState as="h2" title="Nothing here" />);
    expect(screen.getByRole("heading", { level: 2, name: "Nothing here" })).toBeVisible();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });

  it("renders the description and the action when given", () => {
    render(
      <EmptyState
        title="Empty"
        description="Add something."
        action={<button>Add</button>}
      />,
    );
    expect(screen.getByText("Add something.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add" })).toBeVisible();
  });
});
