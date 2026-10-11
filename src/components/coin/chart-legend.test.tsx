import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartLegend } from "./chart-legend";

// 2026-10-10 21:45:00 UTC
const info = { time: Date.UTC(2026, 9, 10, 21, 45) / 1000, value: 83_000 };
const legend = <ChartLegend info={info} mode="line" range="24h" />;

/** A visitor in Warsaw (two hours ahead of UTC in October), whatever machine runs the tests. */
function visitorInWarsaw() {
  const real = Intl.DateTimeFormat.prototype.resolvedOptions;
  return vi
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), locale: "en-US", timeZone: "Europe/Warsaw" };
    });
}

afterEach(() => vi.restoreAllMocks());

describe("ChartLegend: the time it shows", () => {
  it("is written in UTC in the server's HTML, which knows nothing of the visitor", () => {
    visitorInWarsaw();
    expect(renderToString(legend)).toContain("Oct 10, 21:45");
  });

  it("is the visitor's own time in the browser", () => {
    visitorInWarsaw();
    render(legend);
    expect(screen.getByText("Oct 10, 23:45")).toBeInTheDocument();
  });

  it("hydrates the server's text without a mismatch, and then switches to the visitor's time", async () => {
    // What the deployed coin page did: the server (UTC) and the browser (Warsaw) wrote
    // different times, React threw the server HTML away and logged error #418.
    visitorInWarsaw();
    const container = document.createElement("div");
    container.innerHTML = renderToString(legend);
    document.body.append(container);
    expect(container).toHaveTextContent("Oct 10, 21:45");

    const recoverable = vi.fn();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, legend, { onRecoverableError: recoverable });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    expect(container).toHaveTextContent("Oct 10, 23:45");

    act(() => root.unmount());
    container.remove();
  });

  it("shows nothing without a point to show", () => {
    const { container } = render(<ChartLegend info={null} mode="line" range="24h" />);
    expect(container).toBeEmptyDOMElement();
  });
});
