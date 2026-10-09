import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HeatCoin } from "@/lib/api/schemas";
import { buildTreemap, neighborOf } from "@/lib/heatmap";
import { liveStore } from "@/lib/live/client";
import { getSubject, setSubject } from "@/lib/shared-subject";
import { resetRouterCalls, routerCalls } from "@/test/navigation";
import { renderWithClient } from "@/test/render";
import { Treemap } from "./treemap";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);

/** A ResizeObserver whose frame has the size the test says, and which the test can resize. */
const observers: Array<(width: number, height: number) => void> = [];
function stubFrame(width: number, height: number) {
  observers.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        const tell = (w: number, h: number) =>
          this.callback(
            [{ target, contentRect: { width: w, height: h } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
        observers.push(tell);
        tell(width, height);
      }
      unobserve() {}
      disconnect() {}
    },
  );
}
const resize = (w: number, h: number) =>
  act(() => observers.forEach((tell) => tell(w, h)));

function heat(id: string, over: Partial<HeatCoin> = {}): HeatCoin {
  return {
    id,
    symbol: id.toUpperCase(),
    name: id[0]!.toUpperCase() + id.slice(1),
    image: null,
    rank: 1,
    price: 100,
    marketCap: 1000,
    volume24h: 100,
    change1h: 0.1,
    change24h: 2,
    change7d: -4,
    ...over,
  };
}

const COINS = [
  heat("btc", { name: "Bitcoin", rank: 1, price: 80_000, marketCap: 6000 }),
  heat("eth", {
    name: "Ethereum",
    rank: 2,
    price: 3000,
    marketCap: 3000,
    change24h: -4.5,
  }),
  heat("xrp", { name: "Ripple", rank: 3, price: 2, marketCap: 600, change24h: 0.2 }),
  heat("ada", { name: "Cardano", rank: 4, price: 0.5, marketCap: 400, change24h: null }),
  heat("dust", { name: "Dust", rank: 5, price: 1, marketCap: 30 }),
];

function setup(props: Partial<React.ComponentProps<typeof Treemap>> = {}) {
  return renderWithClient(
    <Treemap coins={COINS} period="24h" size="cap" universe={100} {...props} />,
  );
}
const cells = () => screen.getAllByRole("link");
const cell = (name: RegExp) => screen.getByRole("link", { name });
const fillOf = (link: HTMLElement) =>
  link.querySelector<SVGRectElement>(".heat-rect")!.style.fill;
const labelsOf = (link: HTMLElement) =>
  [...link.querySelectorAll("text")].map((t) => t.textContent);
const tip = () => document.querySelector<HTMLElement>("[data-heat-tip]");

beforeEach(() => {
  stubFrame(800, 480);
  resetRouterCalls();
  setSubject(null);
  liveStore.clearData();
});
afterEach(() => vi.unstubAllGlobals());

describe("Treemap: the cells", () => {
  it("draws nothing until the frame has a size, then a link to every asset", () => {
    stubFrame(0, 0);
    setup();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("draws a cell per asset, in rank order, each a link named with everything about it", () => {
    setup();
    expect(cells().map((c) => c.getAttribute("href"))).toEqual([
      "/coin/btc",
      "/coin/eth",
      "/coin/xrp",
      "/coin/ada",
      "/coin/dust",
    ]);
    expect(cell(/^Bitcoin/)).toHaveAccessibleName(
      "Bitcoin (BTC), rank 1, $80,000.00, +2.00% over 24 hours, market cap $6K",
    );
    expect(cell(/^Cardano/)).toHaveAccessibleName(
      expect.stringContaining("no 24 hours change"),
    );
  });

  it("takes only the first `universe` assets", () => {
    setup({ universe: 2 });
    expect(cells()).toHaveLength(2);
  });

  it("fills the cell by the change over the chosen period", () => {
    const { rerender } = setup();
    expect(fillOf(cell(/^Bitcoin/))).toBe("var(--heat-up-1)");
    expect(fillOf(cell(/^Ethereum/))).toBe("var(--heat-down-2)");
    expect(fillOf(cell(/^Ripple/))).toBe("var(--heat-flat)");
    // No number is not "flat": it has its own fill.
    expect(fillOf(cell(/^Cardano/))).toBe("var(--heat-none)");

    rerender(<Treemap coins={COINS} period="7d" size="cap" universe={100} />);
    expect(fillOf(cell(/^Bitcoin/))).toBe("var(--heat-down-1)");
    expect(cell(/^Bitcoin/)).toHaveAccessibleName(
      expect.stringContaining("-4.00% over 7 days"),
    );
  });

  it("sizes by market cap or by volume", () => {
    const areas = (size: "cap" | "volume") => {
      const { unmount } = setup({
        size,
        coins: [
          heat("a", { marketCap: 900, volume24h: 100 }),
          heat("b", { marketCap: 100, volume24h: 900 }),
        ],
      });
      const result = Object.fromEntries(
        cells().map((c) => {
          const rect = c.querySelector(".heat-rect")!;
          return [
            c.getAttribute("data-heat-id"),
            +rect.getAttribute("width")! * +rect.getAttribute("height")!,
          ];
        }),
      ) as Record<"a" | "b", number>;
      unmount();
      return result;
    };
    const byCap = areas("cap");
    expect(byCap.a).toBeGreaterThan(byCap.b);
    const byVolume = areas("volume");
    expect(byVolume.b).toBeGreaterThan(byVolume.a);
  });

  it("keeps each cell's element when the size metric changes the order of the areas, so it can slide", () => {
    const coins = [
      heat("a", { marketCap: 900, volume24h: 100 }),
      heat("b", { marketCap: 100, volume24h: 900 }),
    ];
    // Plain render: the providers `setup` adds would be a different tree on rerender.
    const { rerender } = render(
      <Treemap coins={coins} period="24h" size="cap" universe={100} />,
    );
    const before = cells();
    rerender(<Treemap coins={coins} period="24h" size="volume" universe={100} />);
    const after = cells();
    expect(after).toHaveLength(2);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });

  it("says what fits: a lot in a large cell, little in a small one, nothing in a speck", () => {
    setup();
    expect(labelsOf(cell(/^Bitcoin/))).toEqual(["BTC", "+2.00%", "$80,000.00"]);
    expect(labelsOf(cell(/^Dust/))).toEqual([]);
    // ...but the speck is still a link with its full name.
    expect(cell(/^Dust/)).toHaveAttribute("href", "/coin/dust");
  });

  it("notes the assets it could not draw", () => {
    setup({ coins: [...COINS, heat("nocap", { marketCap: null })] });
    expect(screen.getByText(/1 asset isn't shown/)).toBeInTheDocument();
  });

  it("relays itself when its frame is resized, and snaps instead of sliding while it is", () => {
    setup();
    const widthOf = () =>
      +cell(/^Bitcoin/)
        .querySelector(".heat-rect")!
        .getAttribute("width")!;
    const before = widthOf();
    const frame = document.querySelector<HTMLElement>(".heat-frame")!;
    resize(400, 480);
    expect(widthOf()).toBeLessThan(before);
    expect(frame).toHaveAttribute("data-resizing");
  });

  it("stays dim and busy while the numbers on screen are the old ones", () => {
    setup({ busy: true });
    expect(document.querySelector(".heat-frame")).toHaveAttribute("aria-busy", "true");
  });

  it("is a labelled group, described by how to use it", () => {
    setup();
    const group = screen.getByRole("group", { name: /^Market heatmap of 5 assets/ });
    const hint = document.getElementById(group.getAttribute("aria-describedby")!);
    expect(hint).toHaveTextContent(/arrow keys/i);
  });
});

describe("Treemap: the keyboard", () => {
  it("is one Tab stop, not one per asset", () => {
    setup();
    expect(cells().filter((c) => c.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(cells()[0]).toHaveAttribute("tabindex", "0");
  });

  it("Tab lands on the first cell, and the stop follows focus", async () => {
    const user = userEvent.setup();
    setup();
    await user.tab();
    expect(cells()[0]).toHaveFocus();
    act(() => cell(/^Ethereum/).focus());
    expect(cell(/^Ethereum/)).toHaveAttribute("tabindex", "0");
    expect(cells()[0]).toHaveAttribute("tabindex", "-1");
  });

  it("the arrow keys move to the nearest cell that way", async () => {
    const user = userEvent.setup();
    setup();
    const { tiles } = buildTreemap(COINS, {
      width: 800,
      height: 480,
      size: "cap",
      universe: 100,
    });
    await user.tab();
    for (const [key, direction] of [
      ["{ArrowRight}", "right"],
      ["{ArrowDown}", "down"],
      ["{ArrowLeft}", "left"],
      ["{ArrowUp}", "up"],
    ] as const) {
      const from = document.activeElement!.getAttribute("data-heat-id")!;
      const expected = neighborOf(tiles, from, direction);
      await user.keyboard(key);
      // At an edge nothing happens; otherwise focus is on the neighbour.
      expect(document.activeElement!.getAttribute("data-heat-id")).toBe(expected ?? from);
    }
  });

  it("Home and End jump to the first and the last", async () => {
    const user = userEvent.setup();
    setup();
    await user.tab();
    await user.keyboard("{End}");
    expect(cell(/^Dust/)).toHaveFocus();
    await user.keyboard("{Home}");
    expect(cell(/^Bitcoin/)).toHaveFocus();
  });

  it("leaves chords alone, so the browser's own shortcuts still work", async () => {
    const user = userEvent.setup();
    setup();
    await user.tab();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(cell(/^Bitcoin/)).toHaveFocus();
  });

  it("Enter opens the asset", async () => {
    const user = userEvent.setup();
    setup();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(routerCalls).toEqual(["/coin/btc"]);
  });

  it("shows the details beside the cell the keys moved to, and takes them away with it", async () => {
    const user = userEvent.setup();
    setup();
    await user.tab();
    await user.keyboard("{ArrowRight}");
    const name = document.activeElement!.getAttribute("aria-label")!.split(" (")[0]!;
    expect(tip()).toHaveTextContent(name);
    act(() => (document.activeElement as HTMLElement).blur());
    expect(tip()).toBeNull();
  });

  it("does not show them for a cell that a click focused: the pointer shows them", async () => {
    const user = userEvent.setup();
    setup();
    await user.pointer({ keys: "[MouseLeft>]", target: cell(/^Ripple/) });
    expect(tip()).toBeNull();
  });
});

describe("Treemap: the pointer", () => {
  it("shows the details of the cell under the pointer: all three changes, cap and volume", async () => {
    const user = userEvent.setup();
    setup();
    await user.hover(cell(/^Ethereum/));
    const t = tip()!;
    expect(t).toHaveTextContent("Ethereum");
    expect(t).toHaveTextContent("#2");
    expect(t).toHaveTextContent("+0.10%");
    expect(t).toHaveTextContent("-4.50%");
    expect(t).toHaveTextContent("-4.00%");
    expect(t).toHaveTextContent("$3K");
    expect(t).toHaveTextContent("$100");
    await user.unhover(cell(/^Ethereum/));
    expect(tip()).toBeNull();
  });

  it("keeps the details out of the accessibility tree: each cell's name already says it", async () => {
    const user = userEvent.setup();
    setup();
    await user.hover(cell(/^Ripple/));
    expect(tip()).toHaveAttribute("aria-hidden", "true");
  });

  it("opens the asset on a click, passing the coin on for the page's header", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(cell(/^Bitcoin/));
    expect(routerCalls).toEqual(["/coin/btc"]);
    expect(getSubject()).toMatchObject({ id: "btc", name: "Bitcoin", price: 80_000 });
  });

  it("leaves a click with a modifier to the browser (new tab, new window)", () => {
    setup();
    const link = cell(/^Bitcoin/);
    const notPrevented = fireEvent.click(link, { ctrlKey: true });
    expect(notPrevented).toBe(true);
    fireEvent.click(link, { metaKey: true });
    fireEvent.click(link, { button: 1 });
    expect(routerCalls).toEqual([]);
  });
});

describe("Treemap: touch", () => {
  const tap = (link: HTMLElement) => {
    fireEvent.pointerDown(link, { pointerType: "touch" });
    fireEvent.click(link);
  };

  it("a first tap shows what the cell is, with a button to open it; a second tap opens it", () => {
    setup();
    const link = cell(/^Bitcoin/);
    tap(link);
    expect(routerCalls).toEqual([]);
    expect(tip()).toHaveTextContent("Open Bitcoin");
    tap(link);
    expect(routerCalls).toEqual(["/coin/btc"]);
  });

  it("a tap on another cell moves the details there instead of opening anything", () => {
    setup();
    tap(cell(/^Bitcoin/));
    tap(cell(/^Ethereum/));
    expect(routerCalls).toEqual([]);
    expect(tip()).toHaveTextContent("Open Ethereum");
  });

  it("a tap anywhere else puts the details away", () => {
    setup();
    tap(cell(/^Bitcoin/));
    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    expect(tip()).toBeNull();
  });

  it("does not make a screen-reader or keyboard activation take two steps", async () => {
    const user = userEvent.setup();
    setup();
    tap(cell(/^Bitcoin/));
    expect(routerCalls).toEqual([]);
    // The keyboard follows: a key press says the touch is over.
    cell(/^Ethereum/).focus();
    await user.keyboard("{Enter}");
    expect(routerCalls).toEqual(["/coin/eth"]);
  });
});

describe("Treemap: live prices", () => {
  const tick = (symbol: string, price: number) =>
    act(() => liveStore.applyTicks(new Map([[symbol, { price, time: 1 }]])));

  it("shows the streamed price and flashes the cell's layer green, then red", () => {
    setup();
    const flash = () => cell(/^Bitcoin/).querySelector<SVGRectElement>(".heat-flash")!;
    expect(flash()).not.toHaveAttribute("data-flash");
    tick("BTCUSDT", 80_400);
    expect(labelsOf(cell(/^Bitcoin/))).toContain("$80,400.00");
    expect(flash().dataset.flash).toMatch(/^up-/);
    tick("BTCUSDT", 80_100);
    expect(flash().dataset.flash).toMatch(/^down-/);
  });

  it("recolours the cell when the live 24h change crosses a step", () => {
    setup();
    // +2% at 80,000 means the price was 78,431 a day ago. At 83,800 it is +6.8%: a strong step.
    expect(fillOf(cell(/^Bitcoin/))).toBe("var(--heat-up-1)");
    tick("BTCUSDT", 83_800);
    expect(fillOf(cell(/^Bitcoin/))).toBe("var(--heat-up-3)");
  });

  it("colours the 1h and 7d views by the polled numbers, which the stream can't speak for", () => {
    setup({ period: "7d" });
    tick("BTCUSDT", 83_800);
    expect(fillOf(cell(/^Bitcoin/))).toBe("var(--heat-down-1)");
  });

  it("ignores a price that is plainly another coin with the same ticker", () => {
    setup();
    tick("BTCUSDT", 5);
    expect(labelsOf(cell(/^Bitcoin/))).toContain("$80,000.00");
  });

  it("does not let a tick re-render every cell: only the cell of that symbol", () => {
    setup();
    const before = cell(/^Ethereum/).querySelector("rect")!;
    tick("BTCUSDT", 80_400);
    // The same DOM node: React kept it and left it alone.
    expect(cell(/^Ethereum/).querySelector("rect")).toBe(before);
  });
});

describe("Treemap: cleaning up", () => {
  it("stops watching its frame and drops its tap-away listener when it goes", () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private callback: ResizeObserverCallback) {}
        observe(target: Element) {
          this.callback(
            [{ target, contentRect: { width: 800, height: 480 } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
        }
        unobserve() {}
        disconnect = disconnect;
      },
    );
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = setup();
    fireEvent.pointerDown(cell(/^Bitcoin/), { pointerType: "touch" });
    fireEvent.click(cell(/^Bitcoin/));
    const added = add.mock.calls.filter(([type]) => type === "pointerdown");
    expect(added).toHaveLength(1);

    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(remove.mock.calls.filter(([type]) => type === "pointerdown")).toHaveLength(1);
    add.mockRestore();
    remove.mockRestore();
  });

  it("leaves no live subscription behind: the feed is closed when the picture goes", () => {
    const demand = vi.fn();
    const stop = liveStore.onDemand(demand);
    const { unmount } = setup();
    expect(demand).toHaveBeenLastCalledWith(COINS.length);
    unmount();
    expect(demand).toHaveBeenLastCalledWith(0);
    stop();
  });
});

describe("Treemap: changing what it shows", () => {
  it("removes the cells that leave the universe and keeps the rest", async () => {
    const { rerender } = setup();
    rerender(<Treemap coins={COINS} period="24h" size="cap" universe={2} />);
    await waitFor(() => expect(cells()).toHaveLength(2));
    expect(cells().map((c) => c.getAttribute("data-heat-id"))).toEqual(["btc", "eth"]);
  });

  it("falls back to the first cell as the Tab stop when the focused one goes", async () => {
    const { rerender } = setup();
    act(() => cell(/^Dust/).focus());
    rerender(<Treemap coins={COINS} period="24h" size="cap" universe={2} />);
    await waitFor(() => expect(cells()).toHaveLength(2));
    expect(cells()[0]).toHaveAttribute("tabindex", "0");
  });
});
