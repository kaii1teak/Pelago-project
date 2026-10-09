import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveBadge } from "@/components/ui/live-badge";
import { queryKeys } from "@/lib/api/query-keys";
import { attachBrowserEvents, liveConnection, liveStore } from "@/lib/live/client";
import type { LiveStatus as Status } from "@/lib/live/types";
import { LiveProvider } from "@/providers/live-provider";
import { makeCoin } from "@/test/fixtures";
import { installHistoryMock, uninstallHistoryMock } from "@/test/navigation";
import { renderWithClient } from "@/test/render";
import { LiveChange, LivePrice } from "./live-price";
import { LiveStatus, STATUS_TEXT } from "./live-status";
import { TickerTape } from "./ticker-tape";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);

const btc = { symbol: "BTC", rank: 1, price: 80000, change24h: 2 };
const push = (symbol: string, price: number) =>
  act(() => liveStore.applyTicks(new Map([[symbol, { price, time: 1 }]])));
const priceEl = () => screen.getByText(/^\$/);

beforeEach(() => {
  liveStore.clearData();
  liveStore.setStatus("idle");
});
afterEach(() => vi.restoreAllMocks());

describe("LivePrice", () => {
  it("shows the polled price until a live one comes", () => {
    render(<LivePrice coin={btc} />);
    expect(priceEl()).toHaveTextContent("$80,000.00");
    expect(priceEl()).not.toHaveAttribute("data-flash");
  });

  it("switches to the live price and flashes green when it went up", () => {
    render(<LivePrice coin={btc} />);
    push("BTCUSDT", 80100);
    expect(priceEl()).toHaveTextContent("$80,100.00");
    expect(priceEl().dataset.flash).toMatch(/^up-/);
  });

  it("flashes red when it went down", () => {
    render(<LivePrice coin={btc} />);
    push("BTCUSDT", 79900);
    expect(priceEl().dataset.flash).toMatch(/^down-/);
  });

  it("alternates the animation so two changes in a row both flash", () => {
    render(<LivePrice coin={btc} />);
    push("BTCUSDT", 80100);
    const first = priceEl().dataset.flash;
    push("BTCUSDT", 80200);
    const second = priceEl().dataset.flash;
    push("BTCUSDT", 80300);
    const third = priceEl().dataset.flash;
    expect(new Set([first, second]).size).toBe(2);
    expect(third).toBe(first);
    expect([first, second, third].every((f) => f?.startsWith("up-"))).toBe(true);
  });

  it("does not flash on the first render, or when the price did not change", () => {
    const { rerender } = render(<LivePrice coin={btc} />);
    expect(priceEl()).not.toHaveAttribute("data-flash");
    rerender(<LivePrice coin={{ ...btc }} />);
    expect(priceEl()).not.toHaveAttribute("data-flash");
  });

  it("flashes when the polled price changes too (no live feed for this coin)", () => {
    const { rerender } = render(<LivePrice coin={{ ...btc, symbol: "$ODD" }} />);
    rerender(<LivePrice coin={{ ...btc, symbol: "$ODD", price: 80500 }} />);
    expect(priceEl()).toHaveTextContent("$80,500.00");
    expect(priceEl().dataset.flash).toMatch(/^up-/);
  });

  it("keeps the number's width and the layout: padding with a matching negative margin", () => {
    render(<LivePrice coin={btc} className="text-mono-md" />);
    expect(priceEl()).toHaveClass("-mx-1", "px-1", "num");
  });

  it("re-renders its own symbol only, not on other coins' ticks", () => {
    let renders = 0;
    const Counted = () => {
      renders++;
      return <LivePrice coin={btc} />;
    };
    render(<Counted />);
    const before = renders;
    push("ETHUSDT", 2000);
    expect(renders).toBe(before);
  });
});

describe("LiveChange", () => {
  it("shows the polled change, then the one at the live price", () => {
    render(<LiveChange coin={btc} />);
    expect(screen.getByText("+2.00%")).toBeInTheDocument();
    push("BTCUSDT", 81600); // +2% above the polled price
    // 24h ago was 80000 / 1.02; 81600 against that is about +4.04%
    expect(screen.getByText("+4.04%")).toBeInTheDocument();
  });
});

describe("LiveStatus", () => {
  it.each(Object.keys(STATUS_TEXT) as Status[])("says what '%s' means", (status) => {
    renderWithClient(<LiveStatus />);
    if (status !== "idle") act(() => liveStore.setStatus(status));
    const { label, hint } = STATUS_TEXT[status];
    const el = screen.getByRole("status");
    expect(el).toHaveAccessibleName(`${label}. ${hint}`);
    expect(el).toHaveTextContent(label);
  });

  it("can be focused, so the tooltip is there for the keyboard too", async () => {
    const user = userEvent.setup();
    renderWithClient(<LiveStatus />);
    await user.tab();
    expect(screen.getByRole("status")).toHaveFocus();
  });

  it("says plainly when the feed can't be reached and prices refresh by themselves", () => {
    expect(STATUS_TEXT.polling.hint).toMatch(/can't be reached/i);
    expect(STATUS_TEXT.polling.hint).toMatch(/every minute/i);
  });

  it("follows the feed", () => {
    renderWithClient(<LiveStatus />);
    expect(screen.getByRole("status")).toHaveTextContent("Prices");
    act(() => liveStore.setStatus("live"));
    expect(screen.getByRole("status")).toHaveTextContent("Live");
    act(() => liveStore.setStatus("reconnecting"));
    expect(screen.getByRole("status")).toHaveTextContent("Reconnecting");
  });
});

describe("LiveBadge", () => {
  it("says it refreshes every minute when there is no stream", () => {
    render(<LiveBadge />);
    expect(screen.getByText("Live · refreshes every minute")).toBeInTheDocument();
  });

  it.each([
    ["live", "Live · prices streaming"],
    ["connecting", "Live · connecting"],
    ["reconnecting", "Live · reconnecting"],
    ["paused", "Paused · tab in the background"],
    ["polling", "Polling · refreshes every minute"],
  ] as const)("says '%s' as '%s'", (stream, text) => {
    render(<LiveBadge stream={stream} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("failing refreshes win: the data is old whatever the stream says", () => {
    render(<LiveBadge status="offline" stream="live" />);
    expect(screen.getByText("Reconnecting, showing last data")).toBeInTheDocument();
    expect(screen.queryByText(/streaming/)).toBeNull();
  });
});

describe("TickerTape", () => {
  const coins = Array.from({ length: 30 }, (_, i) =>
    makeCoin({
      id: `coin${i}`,
      name: `Coin ${i}`,
      symbol: `C${i}`,
      rank: i + 1,
      price: 10 + i,
    }),
  );
  const seeded = () =>
    renderWithClient(<TickerTape />, (client) =>
      client.setQueryData(queryKeys.markets(undefined), coins),
    );
  const at = (path: string) => window.history.replaceState(null, "", path);

  beforeEach(() => installHistoryMock());
  afterEach(() => uninstallHistoryMock());

  it("is not shown on the home page, which has its own strip", () => {
    at("/");
    const { container } = seeded();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the top twenty assets on other pages, each with a live price", () => {
    at("/markets");
    seeded();
    const strip = screen.getByRole("region", { name: "Live prices of the top assets" });
    const first = strip.querySelectorAll("ul")[0]!;
    expect(first.querySelectorAll("li")).toHaveLength(20);
    push("C0USDT", 10.5);
    expect(within(first).getByText("$10.50")).toBeInTheDocument();
  });

  it("repeats the list for a seamless loop, hidden from assistive technology and not focusable", () => {
    at("/compare");
    seeded();
    const lists = screen.getByRole("region").querySelectorAll("ul");
    expect(lists).toHaveLength(2);
    expect(lists[1]).toHaveAttribute("aria-hidden", "true");
    expect(lists[1]).toHaveAttribute("inert");
  });

  it("adds no Tab stops of its own besides the status", async () => {
    at("/markets");
    const user = userEvent.setup();
    seeded();
    await user.tab();
    expect(screen.getByRole("status")).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("has the feed's state at its left end", () => {
    at("/markets");
    seeded();
    act(() => liveStore.setStatus("live"));
    expect(within(screen.getByRole("region")).getByRole("status")).toHaveTextContent(
      "Live",
    );
  });

  it("holds its height while the assets load, so the page does not move when they arrive", () => {
    at("/markets");
    renderWithClient(<TickerTape />);
    expect(screen.getByRole("region")).toHaveClass("h-9");
  });

  it("does not run when reduced motion asks for none: the marquee animation is switched off in CSS", () => {
    at("/markets");
    seeded();
    const track = screen.getByRole("region").querySelector(".animate-marquee")!;
    expect(track).toHaveClass(
      "motion-reduce:animate-none",
      "hover:[animation-play-state:paused]",
    );
  });
});

describe("browser events", () => {
  it("a hidden tab closes the live feed and a visible one reopens it", () => {
    const hidden = vi.spyOn(liveConnection, "setHidden");
    const off = attachBrowserEvents();
    expect(hidden).toHaveBeenLastCalledWith(false);

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(hidden).toHaveBeenLastCalledWith(true);

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(hidden).toHaveBeenLastCalledWith(false);
    off();
  });

  it("coming back online retries at once", () => {
    const back = vi.spyOn(liveConnection, "networkBack");
    const off = attachBrowserEvents();
    window.dispatchEvent(new Event("online"));
    expect(back).toHaveBeenCalledTimes(1);
    off();
  });

  it("stops listening when undone", () => {
    const hidden = vi.spyOn(liveConnection, "setHidden");
    const back = vi.spyOn(liveConnection, "networkBack");
    const off = attachBrowserEvents();
    off();
    hidden.mockClear();
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
    expect(hidden).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it("LiveProvider attaches on mount and detaches on unmount", () => {
    const back = vi.spyOn(liveConnection, "networkBack");
    const { unmount } = render(<LiveProvider />);
    window.dispatchEvent(new Event("online"));
    expect(back).toHaveBeenCalledTimes(1);
    unmount();
    window.dispatchEvent(new Event("online"));
    expect(back).toHaveBeenCalledTimes(1);
  });
});
