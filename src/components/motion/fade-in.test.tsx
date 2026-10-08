import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isFirstPage } from "@/lib/session-state";
import { FadeIn } from "./fade-in";

vi.mock("@/lib/session-state", () => ({ isFirstPage: vi.fn() }));

beforeEach(() => vi.mocked(isFirstPage).mockReset());

describe("FadeIn", () => {
  it("shows the first page's content as it is: no entrance, nothing hidden", () => {
    vi.mocked(isFirstPage).mockReturnValue(true);
    render(<FadeIn>content</FadeIn>);
    expect(screen.getByText("content")).not.toHaveClass("animate-fade-in");
  });

  it("eases in content that arrives after the first page", () => {
    vi.mocked(isFirstPage).mockReturnValue(false);
    render(<FadeIn className="space-y-4">content</FadeIn>);
    const box = screen.getByText("content");
    expect(box).toHaveClass("animate-fade-in", "space-y-4");
  });
});
