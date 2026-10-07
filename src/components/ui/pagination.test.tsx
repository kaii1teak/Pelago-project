import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination, getPageWindow } from "./pagination";

describe("getPageWindow", () => {
  it.each([
    [1, 1, [1]],
    [1, 4, [1, 2, 3, 4]],
    [1, 20, [1, 2, "ellipsis", 20]],
    [5, 20, [1, "ellipsis", 4, 5, 6, "ellipsis", 20]],
    [20, 20, [1, "ellipsis", 19, 20]],
    [3, 20, [1, 2, 3, 4, "ellipsis", 20]],
    [18, 20, [1, "ellipsis", 17, 18, 19, 20]],
  ])("page %i of %i", (page, count, expected) => {
    expect(getPageWindow(page, count)).toEqual(expected);
  });

  it("never shows an ellipsis for a single hidden page", () => {
    // [1 . 3 4 5 . 9]: the lone gap at page 2 is shown as "2", not "…"
    expect(getPageWindow(4, 9)).toEqual([1, 2, 3, 4, 5, "ellipsis", 9]);
  });

  it("clamps an out-of-range page", () => {
    expect(getPageWindow(99, 5)).toEqual(getPageWindow(5, 5));
    expect(getPageWindow(-3, 5)).toEqual(getPageWindow(1, 5));
  });
});

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(
      <Pagination page={1} pageCount={1} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("marks the current page and labels every control", () => {
    render(<Pagination page={2} pageCount={4} onPageChange={() => {}} />);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Page 3" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
  });

  it("disables previous on the first page and next on the last", () => {
    const { rerender } = render(
      <Pagination page={1} pageCount={3} onPageChange={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    rerender(<Pagination page={3} pageCount={3} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("reports the page the user picked", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageCount={5} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Page 4" }));
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange.mock.calls.map((c) => c[0])).toEqual([4, 3, 1]);
  });
});
