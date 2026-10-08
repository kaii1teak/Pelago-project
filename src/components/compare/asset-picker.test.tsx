import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeCoin } from "@/test/fixtures";
import { AssetPicker } from "./asset-picker";

const COINS = [
  makeCoin({ id: "bitcoin", name: "Bitcoin", symbol: "BTC", rank: 1 }),
  makeCoin({ id: "ethereum", name: "Ethereum", symbol: "ETH", rank: 2 }),
  makeCoin({ id: "solana", name: "Solana", symbol: "SOL", rank: 5 }),
  makeCoin({ id: "dogecoin", name: "Dogecoin", symbol: "DOGE", rank: 9 }),
];

function setup(props: Partial<React.ComponentProps<typeof AssetPicker>> = {}) {
  const onPick = vi.fn();
  const onRetry = vi.fn();
  const view = render(
    <AssetPicker
      coins={COINS}
      status="ready"
      selectedIds={[]}
      onPick={onPick}
      onRetry={onRetry}
      {...props}
    />,
  );
  const box = screen.getByRole("combobox", { name: "Add an asset to compare" });
  return { ...view, box, onPick, onRetry, user: userEvent.setup() };
}

describe("AssetPicker", () => {
  it("is a closed combobox with a name, until you focus it", async () => {
    const { box, user } = setup();
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();

    await user.click(box);
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "Assets" })).toBeVisible();
    expect(box).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
  });

  it("offers the top assets in rank order, without those already chosen", async () => {
    const { box, user } = setup({ selectedIds: ["ethereum"] });
    await user.click(box);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    // The popup fades in: visible once that has run.
    await waitFor(() => expect(within(options[0]!).getByText("Bitcoin")).toBeVisible());
    ["Bitcoin", "Solana", "Dogecoin"].forEach((name, i) => {
      expect(within(options[i]!).getByText(name)).toBeVisible();
    });
    expect(screen.queryByRole("option", { name: /Ethereum/ })).toBeNull();
  });

  it("keeps the scrolling list out of the Tab order (it would swallow focus and close)", async () => {
    const { box, user } = setup();
    await user.click(box);
    expect(screen.getByRole("listbox").parentElement).toHaveAttribute("tabindex", "-1");
  });

  it("filters by name or symbol as you type", async () => {
    const { box, user } = setup();
    await user.type(box, "sol");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /Solana/ })).toBeVisible();

    await user.clear(box);
    await user.type(box, "doge");
    expect(screen.getByRole("option", { name: /Dogecoin/ })).toBeVisible();
  });

  it("says so when nothing matches", async () => {
    const { box, user } = setup();
    await user.type(box, "zzzz");
    expect(screen.queryByRole("option")).toBeNull();
    expect(screen.getByText("No assets match “zzzz”.")).toBeVisible();
  });

  it("moves a highlight with the arrow keys (announced through aria-activedescendant), wrapping around", async () => {
    const { box, user } = setup();
    await user.click(box);
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(box).toHaveAttribute("aria-activedescendant", options[0]!.id);

    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    expect(box).toHaveAttribute("aria-activedescendant", options[1]!.id);

    await user.keyboard("{ArrowUp}{ArrowUp}");
    // up from the first wraps to the last
    expect(screen.getAllByRole("option").at(-1)).toHaveAttribute("aria-selected", "true");
  });

  it("picks the highlighted asset on Enter, then clears and closes", async () => {
    const { box, user, onPick } = setup();
    await user.type(box, "eth");
    await user.keyboard("{Enter}");
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "ethereum" }));
    expect(box).toHaveValue("");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(box).toHaveFocus();
  });

  it("does nothing on Enter when there is nothing to pick", async () => {
    const { box, user, onPick } = setup();
    await user.type(box, "zzzz{Enter}");
    expect(onPick).not.toHaveBeenCalled();
  });

  it("picks with a click and keeps focus in the box", async () => {
    const { box, user, onPick } = setup();
    await user.click(box);
    await user.click(screen.getByRole("option", { name: /Solana/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "solana" }));
    expect(box).toHaveFocus();
  });

  it("closes on Escape, and a second Escape clears what was typed", async () => {
    const { box, user } = setup();
    await user.type(box, "sol");
    await user.keyboard("{Escape}");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(box).toHaveValue("sol");
    await user.keyboard("{Escape}");
    expect(box).toHaveValue("");
  });

  it("opens with the arrow key when it was closed", async () => {
    const { box, user } = setup();
    box.focus();
    await user.keyboard("{Escape}{ArrowDown}");
    expect(box).toHaveAttribute("aria-expanded", "true");
  });

  it("stays focusable but read-only when the comparison is full, and explains why", async () => {
    const { box, user, onPick } = setup({
      selectedIds: ["a", "b", "c", "d"],
    });
    expect(box).toHaveAttribute("readonly");
    expect(box).toHaveAttribute("aria-disabled", "true");
    expect(box).toHaveAccessibleDescription(/up to 4 assets/i);
    await user.click(box);
    await user.keyboard("{ArrowDown}x");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(box).toHaveValue("");
    expect(onPick).not.toHaveBeenCalled();
  });

  it("shows a loading message while the asset list loads", async () => {
    const { box, user } = setup({ coins: undefined, status: "loading" });
    await user.click(box);
    await waitFor(() => expect(screen.getByText("Loading assets…")).toBeVisible());
  });

  it("offers a retry when the asset list failed to load", async () => {
    const { box, user, onRetry } = setup({ coins: undefined, status: "error" });
    await user.click(box);
    expect(screen.getByText(/couldn.t load the asset list/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("never lists more than eight options", async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      makeCoin({ id: `coin${i}`, name: `Coin ${i}`, rank: i + 1 }),
    );
    const { box, user } = setup({ coins: many });
    await user.click(box);
    expect(screen.getAllByRole("option")).toHaveLength(8);
    await waitFor(() =>
      expect(within(screen.getAllByRole("option")[0]!).getByText("#1")).toBeVisible(),
    );
  });
});
