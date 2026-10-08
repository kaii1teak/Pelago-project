import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPARE_PALETTE } from "@/lib/compare";
import { ColorPicker } from "./color-picker";

function setup(value = 0) {
  const onChange = vi.fn();
  render(<ColorPicker assetName="Bitcoin" value={value} onChange={onChange} />);
  return { onChange, user: userEvent.setup() };
}

const trigger = () => screen.getByRole("button", { name: /Color of Bitcoin/ });
const swatches = () => within(screen.getByRole("radiogroup")).getAllByRole("radio");

afterEach(() => vi.restoreAllMocks());

// jsdom has no layout: say how wide the screen is, and where the open grid ends.
const screenWidth = (width: number) =>
  vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(width);

describe("ColorPicker", () => {
  it("names the asset, the current color, and what pressing it does", () => {
    setup(7);
    expect(trigger()).toHaveAccessibleName("Color of Bitcoin: Cyan. Change");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("opens a grid of all ten colors, with the current one checked", async () => {
    const { user } = setup(3);
    await user.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("radiogroup", { name: "Color for Bitcoin" })).toBeVisible();
    expect(swatches().map((s) => s.getAttribute("aria-label"))).toEqual(
      COMPARE_PALETTE.map((c) => c.name),
    );
    expect(
      swatches().filter((s) => s.getAttribute("aria-checked") === "true"),
    ).toHaveLength(1);
    expect(swatches()[3]).toHaveAttribute("aria-checked", "true");
  });

  it("moves focus to the current color when it opens", async () => {
    const { user } = setup(5);
    await user.click(trigger());
    expect(swatches()[5]).toHaveFocus();
  });

  it("picks a color, closes, and returns focus to the swatch button", async () => {
    const { user, onChange } = setup(0);
    await user.click(trigger());
    await user.click(screen.getByRole("radio", { name: "Magenta" }));
    expect(onChange).toHaveBeenCalledWith(5);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it("has one Tab stop in the grid (the current color); arrows move, wrapping around", async () => {
    const { user } = setup(0);
    await user.click(trigger());
    expect(swatches().filter((s) => s.tabIndex === 0)).toHaveLength(1);

    await user.keyboard("{ArrowRight}");
    expect(swatches()[1]).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(swatches()[9]).toHaveFocus(); // wrapped to the last
    await user.keyboard("{Home}");
    expect(swatches()[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(swatches()[9]).toHaveFocus();
  });

  it("picks with the keyboard", async () => {
    const { user, onChange } = setup(0);
    await user.click(trigger());
    await user.keyboard("{ArrowRight}{ArrowRight}{Enter}");
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("closes on Escape and gives focus back, without leaking Escape to a parent dialog", async () => {
    const { user, onChange } = setup(0);
    const parent = vi.fn();
    document.addEventListener("keydown", parent);
    await user.click(trigger());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(trigger()).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    document.removeEventListener("keydown", parent);
  });

  it("closes when you click elsewhere", async () => {
    const { user } = setup(0);
    await user.click(trigger());
    await user.click(document.body);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("toggles closed when the swatch is pressed again", async () => {
    const { user } = setup(0);
    await user.click(trigger());
    await user.click(trigger());
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
  it("is as wide as its ten colors, not as wide as the 16px swatch it hangs from", async () => {
    // jsdom has no layout, so this guards the class that makes the real browser do it.
    const { user } = setup(0);
    await user.click(trigger());
    expect(screen.getByRole("radiogroup")).toHaveClass("w-max");
  });

  it("hangs from the left edge of the swatch while it fits on screen", async () => {
    screenWidth(1024);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      right: 300,
    } as DOMRect);
    const { user } = setup(0);
    await user.click(trigger());
    const grid = screen.getByRole("radiogroup");
    expect(grid.style.left).toBe("");
    expect(grid.style.right).toBe("");
  });

  it("hangs from the right edge instead when it would run off the screen", async () => {
    screenWidth(390);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      right: 450,
    } as DOMRect);
    const { user } = setup(0);
    await user.click(trigger());
    const grid = screen.getByRole("radiogroup");
    expect(grid.style.right).toBe("0px");
    expect(grid.style.left).toBe("auto");
  });
});
