import { render, screen } from "@testing-library/react";
import { AnimatePresence, MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresenceLi } from "./presence-li";

// The suite skips animations; this test is about the moments while one is running.
beforeEach(() => {
  MotionGlobalConfig.skipAnimations = false;
});
afterEach(() => {
  MotionGlobalConfig.skipAnimations = true;
});

const list = (ids: string[]) => (
  <ul>
    <AnimatePresence initial={false}>
      {ids.map((id) => (
        <PresenceLi key={id} exit={{ opacity: 0, transition: { duration: 30 } }}>
          <button>{id}</button>
        </PresenceLi>
      ))}
    </AnimatePresence>
  </ul>
);

describe("PresenceLi", () => {
  it("is a normal, usable list item while it stays", () => {
    render(list(["a", "b"]));
    for (const item of screen.getAllByRole("listitem"))
      expect(item).not.toHaveAttribute("inert");
  });

  it("goes inert while it fades out, so nothing in it can be focused or clicked", () => {
    const { rerender } = render(list(["a", "b"]));
    rerender(list(["a"]));
    // Still in the document (it is mid-exit), but out of reach.
    const leaving = screen
      .getByRole("button", { name: "b", hidden: true })
      .closest("li")!;
    expect(leaving).toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "a" }).closest("li")).not.toHaveAttribute(
      "inert",
    );
  });
});
