import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as ViewTransitionModule from "./view-transition";
import { setSubject } from "@/lib/shared-subject";
import { CoinLink } from "./coin-link";
import { SharedCoin, SharedCoinTarget } from "./shared-coin";

// Plain React has no <ViewTransition>; stand in for it with a box that shows what it was given.
vi.mock("./view-transition", async (original) => ({
  ...(await original<typeof ViewTransitionModule>()),
  ViewTransition: ({
    name,
    share,
    default: fallback,
    children,
  }: {
    name?: string;
    share?: string;
    default?: string;
    children: React.ReactNode;
  }) => (
    <div
      data-testid="vt"
      data-name={name ?? ""}
      data-share={share}
      data-default={fallback}
    >
      {children}
    </div>
  ),
}));

// next/link would need the app router; this keeps what the test cares about visible.
vi.mock("next/link", () => ({
  default: ({
    href,
    transitionTypes,
    onClick,
    children,
  }: {
    href: string;
    transitionTypes?: string[];
    onClick?: () => void;
    children: React.ReactNode;
  }) => (
    <a
      href={href}
      data-transition-types={transitionTypes?.join(" ")}
      onClick={(event) => {
        event.preventDefault(); // no navigation in a unit test
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

const coin = { id: "bitcoin", name: "Bitcoin", symbol: "BTC", image: null, price: 80000 };
afterEach(() => act(() => setSubject(null)));

describe("SharedCoin", () => {
  it("is not named while no coin was chosen", () => {
    render(
      <SharedCoin id="bitcoin" part="logo">
        <span>logo</span>
      </SharedCoin>,
    );
    expect(screen.getByTestId("vt")).toHaveAttribute("data-name", "");
  });

  it("is named after its part once its coin is the chosen one, and only then", () => {
    render(
      <>
        <SharedCoin id="bitcoin" part="logo">
          <span>btc logo</span>
        </SharedCoin>
        <SharedCoin id="ethereum" part="logo">
          <span>eth logo</span>
        </SharedCoin>
      </>,
    );
    act(() => setSubject(coin));
    const [btc, eth] = screen.getAllByTestId("vt");
    expect(btc).toHaveAttribute("data-name", "coin-logo");
    expect(eth).toHaveAttribute("data-name", "");
  });

  it("morphs between pages and runs no animation of its own", () => {
    render(
      <SharedCoin id="bitcoin" part="price">
        <span>price</span>
      </SharedCoin>,
    );
    const box = screen.getByTestId("vt");
    expect(box).toHaveAttribute("data-share", "morph");
    expect(box).toHaveAttribute("data-default", "none");
  });

  it("names each part differently", () => {
    render(
      <>
        <SharedCoin id="bitcoin" part="logo">
          <span />
        </SharedCoin>
        <SharedCoin id="bitcoin" part="name">
          <span />
        </SharedCoin>
        <SharedCoin id="bitcoin" part="price">
          <span />
        </SharedCoin>
      </>,
    );
    act(() => setSubject(coin));
    expect(screen.getAllByTestId("vt").map((n) => n.getAttribute("data-name"))).toEqual([
      "coin-logo",
      "coin-name",
      "coin-price",
    ]);
  });
});

describe("SharedCoinTarget (the asset page side)", () => {
  it("is always named: there is only one coin on that page", () => {
    render(
      <SharedCoinTarget part="name">
        <span>Bitcoin</span>
      </SharedCoinTarget>,
    );
    expect(screen.getByTestId("vt")).toHaveAttribute("data-name", "coin-name");
  });
});

describe("CoinLink", () => {
  it("links to the coin page and remembers the coin when clicked", async () => {
    render(
      <>
        <CoinLink coin={coin}>Open Bitcoin</CoinLink>
        <SharedCoin id="bitcoin" part="logo">
          <span />
        </SharedCoin>
      </>,
    );
    const link = screen.getByRole("link", { name: "Open Bitcoin" });
    expect(link).toHaveAttribute("href", "/coin/bitcoin");
    // Going to a coin is "deeper": the page slides in that way (see globals.css).
    expect(link).toHaveAttribute("data-transition-types", "nav-forward");
    expect(screen.getByTestId("vt")).toHaveAttribute("data-name", "");
    // Clicking makes this row the chosen one.
    await userEvent.click(link);
    expect(screen.getByTestId("vt")).toHaveAttribute("data-name", "coin-logo");
  });
});
