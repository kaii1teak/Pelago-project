import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoinLogo } from "./coin-logo";

const LARGE =
  "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1547033579";

describe("CoinLogo", () => {
  it("requests the small CDN variant instead of the 250px one", () => {
    const { container } = render(<CoinLogo src={LARGE} name="Bitcoin" />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toContain("/small/bitcoin.png");
    expect(img.getAttribute("src")).not.toContain("/large/");
  });

  it("keeps the sharp 250px logo for big avatars like the asset page header", () => {
    const { container } = render(<CoinLogo src={LARGE} name="Bitcoin" size={48} />);
    expect(container.querySelector("img")!.getAttribute("src")).toContain("/large/");
  });

  it("is decorative: the name is always rendered beside it", () => {
    const { container } = render(<CoinLogo src={LARGE} name="Bitcoin" />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("falls back to a letter avatar when there's no image", () => {
    render(<CoinLogo src={null} name="solana" />);
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("falls back to the letter avatar if the image fails to load", () => {
    const { container } = render(<CoinLogo src={LARGE} name="Bitcoin" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("reserves its size (no layout shift) in every state", () => {
    const { container } = render(<CoinLogo src={null} name="x" size={40} />);
    expect(container.firstElementChild).toHaveStyle({ width: "40px", height: "40px" });
  });
});
