import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import { makeCoin } from "@/test/fixtures";
import { mockApi, renderWithClient } from "@/test/render";
import { AssetMarquee } from "./asset-marquee";

afterEach(() => vi.unstubAllGlobals());

const coins = Array.from({ length: 30 }, (_, i) =>
  makeCoin({ id: `coin${i + 1}`, name: `Coin ${i + 1}`, symbol: `C${i + 1}` }),
);

const setup = () =>
  renderWithClient(<AssetMarquee />, (c) => c.setQueryData(queryKeys.markets(), coins));

describe("AssetMarquee", () => {
  it("shows the top 20 assets as links to their pages", () => {
    setup();
    const lists = screen.getAllByRole("list", { hidden: true });
    const real = within(lists[0]!).getAllByRole("link");
    expect(real).toHaveLength(20);
    expect(real[0]).toHaveAttribute("href", "/coin/coin1");
  });

  it("renders the list twice for a seamless loop, hiding the copy from assistive tech", () => {
    setup();
    const [first, second] = screen.getAllByRole("list", { hidden: true });
    expect(first).not.toHaveAttribute("aria-hidden");
    expect(second).toHaveAttribute("aria-hidden", "true");
    // inert: the duplicate's links must not be reachable by Tab either.
    expect(second).toHaveAttribute("inert");
    // Only the real copy is exposed.
    expect(screen.getAllByRole("link")).toHaveLength(20);
  });

  it("has a real pause control, not just hover (WCAG 2.2.2)", async () => {
    setup();
    const pause = screen.getByRole("button", { name: "Pause ticker" });
    expect(pause).toHaveAttribute("aria-pressed", "false");
    const track = pause.parentElement!.querySelector(".animate-marquee")!;
    expect(track).not.toHaveClass("[animation-play-state:paused]");

    await userEvent.click(pause);
    expect(pause).toHaveAttribute("aria-pressed", "true");
    expect(track).toHaveClass("[animation-play-state:paused]");

    await userEvent.click(pause);
    expect(pause).toHaveAttribute("aria-pressed", "false");
  });

  it("the pause button is keyboard operable", async () => {
    setup();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Pause ticker" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Pause ticker" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("pauses while hovered, and drops all motion under reduced motion", () => {
    setup();
    const track = document.querySelector(".animate-marquee")!;
    expect(track.className).toContain("hover:[animation-play-state:paused]");
    expect(track.className).toContain("motion-reduce:animate-none");
  });

  it("is a single tab stop: the 20 links are out of the tab order but still real links", async () => {
    setup();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(20);
    for (const link of links) expect(link).toHaveAttribute("tabindex", "-1");

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Pause ticker" })).toHaveFocus();
    await userEvent.tab(); // nothing else focusable in the strip: focus leaves it
    expect(links.some((l) => l === document.activeElement)).toBe(false);
  });

  it("holds its height with a placeholder while loading", () => {
    mockApi({ "/api/markets": "pending" });
    const { container } = renderWithClient(<AssetMarquee />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild).toHaveClass("h-14");
  });

  it("renders nothing on failure: the stats strip owns the error UI", async () => {
    mockApi({ "/api/markets": "fail" });
    const { container } = renderWithClient(<AssetMarquee />);
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
