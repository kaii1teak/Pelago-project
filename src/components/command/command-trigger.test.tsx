import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePaletteStore } from "@/stores/palette";
import { CommandTrigger } from "./command-trigger";

beforeEach(() => usePaletteStore.setState({ open: false }));
afterEach(() => vi.restoreAllMocks());

/** [the field-like button, the phones' icon button] */
const buttons = () => [
  screen.getByRole("button", { name: /^Search (Ctrl|⌘) K$/ }),
  screen.getByRole("button", { name: "Search assets and pages" }),
];

describe("CommandTrigger", () => {
  it("has a field-like button for wide screens and an icon button for phones, both named", () => {
    render(<CommandTrigger />);
    const [wide, icon] = buttons();
    expect(wide).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
  });

  it("names the wide button by its visible text, keycap included (WCAG 2.5.3 label in name)", () => {
    render(<CommandTrigger />);
    const [wide] = buttons();
    expect(wide).not.toHaveAttribute("aria-label");
    expect(wide).toHaveAccessibleName("Search Ctrl K");
  });

  it("opens the palette from either", async () => {
    render(<CommandTrigger />);
    await userEvent.click(buttons()[0]!);
    expect(usePaletteStore.getState().open).toBe(true);

    act(() => usePaletteStore.setState({ open: false }));
    await userEvent.click(buttons()[1]!);
    expect(usePaletteStore.getState().open).toBe(true);
  });

  it("announces that it opens a dialog and which keys do it", () => {
    render(<CommandTrigger />);
    const [wide] = buttons();
    expect(wide).toHaveAttribute("aria-haspopup", "dialog");
    expect(wide).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
  });

  it("shows Ctrl K by default", () => {
    render(<CommandTrigger />);
    expect(screen.getByText("Ctrl K")).toBeInTheDocument();
  });

  it("shows ⌘ K on Apple devices", () => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");
    render(<CommandTrigger />);
    expect(screen.getByText("⌘ K")).toBeInTheDocument();
    expect(buttons()[0]).toHaveAccessibleName("Search ⌘ K");
  });
});
