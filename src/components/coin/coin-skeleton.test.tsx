import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setSubject } from "@/lib/shared-subject";
import { installHistoryMock, uninstallHistoryMock } from "@/test/navigation";
import { CoinSkeleton } from "./coin-skeleton";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);

const bitcoin = {
  id: "bitcoin",
  name: "Bitcoin",
  symbol: "BTC",
  image: null,
  price: 80000,
};

beforeEach(() => {
  installHistoryMock();
  window.history.replaceState(null, "", "/coin/bitcoin");
});
afterEach(() => {
  uninstallHistoryMock();
  act(() => setSubject(null));
});

describe("CoinSkeleton header", () => {
  it("is a plain placeholder when no coin was picked on the way here", () => {
    render(<CoinSkeleton />);
    expect(screen.getByRole("status", { name: "Loading asset" })).toBeInTheDocument();
    expect(screen.queryByText("Bitcoin")).toBeNull();
  });

  it("shows the picked coin's name, symbol and price for real while the rest loads", () => {
    setSubject(bitcoin);
    render(<CoinSkeleton />);
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("$80,000.00")).toBeInTheDocument();
    // Still announced as loading, and the name is not a second heading.
    expect(screen.getByRole("status", { name: "Loading asset" })).toBeInTheDocument();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("ignores a coin picked earlier when this page is for another one", () => {
    setSubject({ ...bitcoin, id: "ethereum", name: "Ethereum", symbol: "ETH" });
    render(<CoinSkeleton />);
    expect(screen.queryByText("Ethereum")).toBeNull();
  });
});
