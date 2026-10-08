import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssetChips, type AssetChipData } from "./asset-chips";
import { Swatch } from "./color-picker";

const base: AssetChipData = {
  id: "bitcoin",
  color: 0,
  name: "Bitcoin",
  symbol: "BTC",
  image: null,
  change: 12.5,
  state: "ready",
};

function setup(assets: AssetChipData[]) {
  const onRemove = vi.fn();
  const onRetry = vi.fn();
  const onColor = vi.fn();
  render(
    <AssetChips
      assets={assets}
      onRemove={onRemove}
      onRetry={onRetry}
      onColor={onColor}
    />,
  );
  return { onRemove, onRetry, onColor, user: userEvent.setup() };
}

describe("AssetChips", () => {
  it("renders nothing when there are no assets", () => {
    const { container } = render(
      <AssetChips
        assets={[]}
        onRemove={() => {}}
        onRetry={() => {}}
        onColor={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each asset with its name, symbol and change over the range", () => {
    setup([
      base,
      {
        ...base,
        id: "ethereum",
        color: 7,
        name: "Ethereum",
        symbol: "ETH",
        change: -3.4,
      },
    ]);
    const list = screen.getByRole("list", { name: "Assets being compared" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("Bitcoin")).toBeVisible();
    expect(within(items[0]!).getByText("BTC")).toBeVisible();
    expect(within(items[0]!).getByText("+12.50%")).toBeVisible();
    expect(within(items[1]!).getByText("-3.40%")).toBeVisible();
  });

  it("removes by name: the button says which asset it removes", async () => {
    const { onRemove, user } = setup([base]);
    await user.click(screen.getByRole("button", { name: "Remove Bitcoin" }));
    expect(onRemove).toHaveBeenCalledWith("bitcoin");
  });

  it("shows a placeholder while the chart loads", () => {
    setup([{ ...base, state: "loading", change: null }]);
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("offers a retry for a chart that failed, instead of a silent gap", async () => {
    const { onRetry, user } = setup([{ ...base, state: "error", change: null }]);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledWith("bitcoin");
  });

  it("says when an asset does not exist, and still lets you remove it", async () => {
    const { onRemove, user } = setup([
      { ...base, id: "nope", name: "nope", symbol: null, state: "missing", change: null },
    ]);
    expect(screen.getByText("Not found")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove nope" }));
    expect(onRemove).toHaveBeenCalledWith("nope");
  });
});

describe("Swatch", () => {
  it("takes its color from the design token for its color, so it follows the theme", () => {
    const { container } = render(<Swatch color={7} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el.style.backgroundColor).toBe("var(--chart-8-line)");
  });

  it("wraps around rather than showing nothing for an unknown color", () => {
    const { container } = render(<Swatch color={10} />);
    expect((container.firstElementChild as HTMLElement).style.backgroundColor).toBe(
      "var(--chart-1-line)",
    );
  });
});
