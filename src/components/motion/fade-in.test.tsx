import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FadeIn } from "./fade-in";

describe("FadeIn", () => {
  it("eases in content that is built in the browser (a skeleton replaced by its data)", () => {
    render(<FadeIn className="space-y-4">content</FadeIn>);
    const box = screen.getByText("content");
    expect(box).toHaveClass("animate-fade-in", "space-y-4");
  });

  it("writes content as it is when it is rendered on the server: no entrance, nothing hidden", () => {
    const html = renderToString(<FadeIn className="space-y-4">content</FadeIn>);
    expect(html).not.toContain("animate-fade-in");
    expect(html).toContain("space-y-4");
  });

  it("hydrates server HTML without animating it and without a mismatch, even late", async () => {
    // The server's HTML never has the class...
    const container = document.createElement("div");
    container.innerHTML = renderToString(<FadeIn className="space-y-4">content</FadeIn>);
    document.body.append(container);

    // ...and hydration, however late it happens in the page's life, must produce the same:
    // a different class is the attribute mismatch React warned about in development.
    const recoverable = vi.fn();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, <FadeIn className="space-y-4">content</FadeIn>, {
        onRecoverableError: recoverable,
      });
    });

    const box = container.firstElementChild!;
    expect(box).not.toHaveClass("animate-fade-in");
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
    errors.mockRestore();
  });
});
