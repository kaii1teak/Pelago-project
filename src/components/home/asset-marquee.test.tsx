import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("has no Pause button: it is decoration, and nothing in it needs operating", () => {
    setup();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("pauses while hovered, and drops all motion under reduced motion", () => {
    setup();
    const track = document.querySelector(".animate-marquee")!;
    expect(track.className).toContain("hover:[animation-play-state:paused]");
    expect(track.className).toContain("motion-reduce:animate-none");
  });

  it("is not in the tab order: the 20 links are real links but never tab stops", async () => {
    setup();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(20);
    for (const link of links) expect(link).toHaveAttribute("tabindex", "-1");

    await userEvent.tab();
    expect(links.some((l) => l === document.activeElement)).toBe(false);
    expect(document.body).toHaveFocus();
  });

  it("sticks under the header once the page is scrolled to it, and sits above the content that passes under", () => {
    renderWithClient(<AssetMarquee />, (c) =>
      c.setQueryData(queryKeys.markets(), [makeCoin({ id: "bitcoin" })]),
    );
    const strip = screen.getByRole("region", { name: "Top assets" });
    expect(strip).toHaveClass("sticky", "top-home-strip", "z-30", "bg-primary");
  });

  describe("while it is stuck", () => {
    const rect = (top: number) =>
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        top,
        bottom: top + 56,
        left: 0,
        right: 0,
        width: 0,
        height: 56,
        x: 0,
        y: top,
        toJSON: () => ({}),
      });
    const mountStrip = () => {
      renderWithClient(<AssetMarquee />, (c) =>
        c.setQueryData(queryKeys.markets(), [makeCoin({ id: "bitcoin" })]),
      );
      const strip = screen.getByRole("region", { name: "Top assets" });
      // Where it sticks. (jsdom has no stylesheet: it would come from top-home-strip.)
      strip.style.top = "44px";
      return strip;
    };
    // Animation frames wait until the test lets them run, as in a browser (the strip looks at
    // most once per frame, however many scroll events come).
    let frames: FrameRequestCallback[] = [];
    const scrollTo = () => {
      act(() => {
        window.dispatchEvent(new Event("scroll"));
        const due = frames;
        frames = [];
        for (const frame of due) frame(0);
      });
    };

    beforeEach(() => {
      frames = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
    });
    afterEach(() => vi.restoreAllMocks());

    it("is marked stuck once its top reaches where it sticks, and unmarked when it leaves", () => {
      rect(500);
      const strip = mountStrip();
      expect(strip).not.toHaveAttribute("data-stuck");

      rect(44);
      scrollTo();
      expect(strip).toHaveAttribute("data-stuck", "true");

      rect(300);
      scrollTo();
      expect(strip).not.toHaveAttribute("data-stuck");
    });

    it("shrinks its items to the size of the strip on the other pages only then", () => {
      rect(500);
      const strip = mountStrip();
      const link = within(strip).getAllByRole("link", { hidden: true })[0]!;
      // Resting size, and the stuck size that applies when the strip is marked.
      expect(link).toHaveClass("h-[calc(var(--strip-home-h)-2px)]");
      expect(link).toHaveClass(
        "group-data-[stuck=true]/strip:h-[calc(var(--strip-stuck-h)-1px)]",
      );
      expect(link).toHaveClass("group-data-[stuck=true]/strip:px-4");
      expect(strip).toHaveClass("group/strip");
    });

    it("stops listening when the page goes", () => {
      rect(500);
      const remove = vi.spyOn(window, "removeEventListener");
      renderWithClient(<AssetMarquee />, (c) =>
        c.setQueryData(queryKeys.markets(), [makeCoin({ id: "bitcoin" })]),
      ).unmount();
      const types = remove.mock.calls.map(([type]) => type);
      expect(types).toContain("scroll");
      expect(types).toContain("resize");
    });
  });

  it("holds its height with a placeholder while loading", () => {
    mockApi({ "/api/markets": "pending" });
    const { container } = renderWithClient(<AssetMarquee />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    // The same box as the strip itself (sticky, same height), so nothing moves when it fills.
    expect(container.firstElementChild).toHaveClass(
      "sticky",
      "top-home-strip",
      "h-[var(--strip-home-h)]",
    );
  });

  it("renders nothing on failure: the stats strip owns the error UI", async () => {
    mockApi({ "/api/markets": "fail" });
    const { container } = renderWithClient(<AssetMarquee />);
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
