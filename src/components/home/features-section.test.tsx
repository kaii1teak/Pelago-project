import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as MotionReact from "motion/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeaturesSection } from "./features-section";

// Drive the section's two inputs ourselves: the media query and scroll progress.
const state = vi.hoisted(() => ({ desktop: false, progress: undefined as unknown }));

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => state.desktop }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof MotionReact>();
  state.progress = actual.motionValue(0);
  return { ...actual, useScroll: () => ({ scrollYProgress: state.progress }) };
});

const scrollTo = vi.fn();
const progress = () => state.progress as { set: (v: number) => void };
const trigger = (name: RegExp) => screen.getByRole("button", { name });
const panelOf = (name: RegExp) =>
  document.getElementById(trigger(name).getAttribute("aria-controls")!)!;

beforeEach(() => {
  state.desktop = false;
  progress().set(0);
  scrollTo.mockClear();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
});

describe("FeaturesSection: structure", () => {
  it("is a numbered list of four items, each a heading with a real button", () => {
    render(<FeaturesSection />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("shows the first item expanded and the rest collapsed", () => {
    render(<FeaturesSection />);
    expect(trigger(/Live, without the noise/)).toHaveAttribute("aria-expanded", "true");
    expect(trigger(/Charts built for reading/)).toHaveAttribute("aria-expanded", "false");
  });

  it("collapsed content is inert, so Tab can't land on hidden links", () => {
    render(<FeaturesSection />);
    const collapsed = panelOf(/Charts built for reading/).firstElementChild!;
    expect(collapsed).toHaveAttribute("inert");
    const open = panelOf(/Live, without the noise/).firstElementChild!;
    expect(open).not.toHaveAttribute("inert");
  });

  it("each panel is a labelled region wired to its button", () => {
    render(<FeaturesSection />);
    const button = trigger(/Compare on equal footing/);
    const panel = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(panel).toHaveAttribute("role", "region");
  });
});

describe("FeaturesSection: accordion (below lg)", () => {
  it("opens one item at a time", async () => {
    render(<FeaturesSection />);
    await userEvent.click(trigger(/Compare on equal footing/));
    expect(trigger(/Compare on equal footing/)).toHaveAttribute("aria-expanded", "true");
    expect(trigger(/Live, without the noise/)).toHaveAttribute("aria-expanded", "false");
  });

  it("clicking the open item closes it", async () => {
    render(<FeaturesSection />);
    await userEvent.click(trigger(/Live, without the noise/));
    expect(trigger(/Live, without the noise/)).toHaveAttribute("aria-expanded", "false");
  });

  it("works from the keyboard", async () => {
    render(<FeaturesSection />);
    trigger(/Charts built for reading/).focus();
    await userEvent.keyboard("{Enter}");
    expect(trigger(/Charts built for reading/)).toHaveAttribute("aria-expanded", "true");
  });

  it("ignores scroll position (scroll only drives the desktop layout)", () => {
    render(<FeaturesSection />);
    act(() => progress().set(0.9));
    expect(trigger(/Live, without the noise/)).toHaveAttribute("aria-expanded", "true");
  });

  it("does not scroll the page when an item is clicked", async () => {
    render(<FeaturesSection />);
    await userEvent.click(trigger(/Charts built for reading/));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("FeaturesSection: pinned list (lg and up)", () => {
  beforeEach(() => {
    state.desktop = true;
  });

  it("scroll progress picks the active item", () => {
    render(<FeaturesSection />);
    act(() => progress().set(0.3));
    expect(trigger(/Charts built for reading/)).toHaveAttribute("aria-expanded", "true");
    act(() => progress().set(0.6));
    expect(trigger(/Compare on equal footing/)).toHaveAttribute("aria-expanded", "true");
    act(() => progress().set(0.99));
    expect(trigger(/A watchlist that remembers/)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    act(() => progress().set(0));
    expect(trigger(/Live, without the noise/)).toHaveAttribute("aria-expanded", "true");
  });

  it("exactly one item is expanded at any scroll position", () => {
    render(<FeaturesSection />);
    for (const p of [0, 0.1, 0.24, 0.26, 0.5, 0.74, 0.76, 1]) {
      act(() => progress().set(p));
      const open = screen
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-expanded") === "true");
      expect(open).toHaveLength(1);
    }
  });

  it("clicking an item scrolls to it instead of toggling (the scroll position owns the state)", async () => {
    render(<FeaturesSection />);
    await userEvent.click(trigger(/Compare on equal footing/));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    // Still driven by scroll: nothing opened until the page actually scrolls there.
    expect(trigger(/Compare on equal footing/)).toHaveAttribute("aria-expanded", "false");
  });

  it("the position it scrolls to lands inside that item's band", async () => {
    // jsdom has no layout; give the section a known size so the math is checkable.
    render(<FeaturesSection />);
    const section = document.querySelector("section")!;
    Object.defineProperty(section, "offsetHeight", { value: 4000, configurable: true });
    vi.spyOn(section, "getBoundingClientRect").mockReturnValue({ top: 0 } as DOMRect);
    Object.defineProperty(window, "innerHeight", { value: 1000, configurable: true });
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });

    await userEvent.click(trigger(/Compare on equal footing/)); // index 2 of 4
    const top = (scrollTo.mock.calls[0]![0] as { top: number }).top;
    const progressAtTarget = top / (4000 - 1000);
    expect(Math.floor(progressAtTarget * 4)).toBe(2);
  });

  it("shows a [nn] / [nn] progress readout", () => {
    render(<FeaturesSection />);
    act(() => progress().set(0.6));
    expect(screen.getByText(/\[03\] \/ \[04\]/)).toBeInTheDocument();
  });
});
