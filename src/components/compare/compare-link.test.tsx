import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { dispatcher } from "@/hooks/use-hotkey";
import { useCompareStore } from "@/stores/compare";
import { renderWithClient } from "@/test/render";
import { CompareLink } from "./compare-link";

beforeEach(() => {
  localStorage.clear();
  useCompareStore.setState({ ids: [] });
});

describe("CompareLink", () => {
  it("is a link to the comparison, named for the asset it adds", () => {
    renderWithClient(<CompareLink id="bitcoin" name="Bitcoin" />);
    expect(
      screen.getByRole("link", { name: "Compare Bitcoin with other assets" }),
    ).toHaveAttribute("href", "/compare");
  });

  it("adds the asset to the saved selection when followed", async () => {
    renderWithClient(<CompareLink id="bitcoin" name="Bitcoin" />);
    await userEvent.click(screen.getByRole("link"));
    expect(useCompareStore.getState().ids).toEqual(["bitcoin"]);
  });

  it("joins what is already being compared instead of replacing it", async () => {
    useCompareStore.setState({ ids: ["ethereum"] });
    renderWithClient(<CompareLink id="bitcoin" name="Bitcoin" />);
    await userEvent.click(screen.getByRole("link"));
    expect(useCompareStore.getState().ids).toEqual(["ethereum", "bitcoin"]);
  });

  it("does not duplicate an asset that is already there", async () => {
    useCompareStore.setState({ ids: ["bitcoin"] });
    renderWithClient(<CompareLink id="bitcoin" name="Bitcoin" />);
    await userEvent.click(screen.getByRole("link"));
    expect(useCompareStore.getState().ids).toEqual(["bitcoin"]);
  });

  it("still opens the comparison when it is full, without pushing anything out", async () => {
    useCompareStore.setState({ ids: ["a", "b", "c", "d"] });
    renderWithClient(<CompareLink id="bitcoin" name="Bitcoin" />);
    await userEvent.click(screen.getByRole("link"));
    expect(useCompareStore.getState().ids).toEqual(["a", "b", "c", "d"]);
  });

  it("is pressed by the A key: the same as following it", () => {
    renderWithClient(<CompareLink id="bitcoin" name="Bitcoin" />);
    act(() =>
      dispatcher.handleKeyDown(new KeyboardEvent("keydown", { key: "a", code: "KeyA" })),
    );
    expect(useCompareStore.getState().ids).toEqual(["bitcoin"]);
  });

  it("answers to A only while it is on screen", () => {
    const { unmount } = renderWithClient(<CompareLink id="bitcoin" name="Bitcoin" />);
    unmount();
    act(() =>
      dispatcher.handleKeyDown(new KeyboardEvent("keydown", { key: "a", code: "KeyA" })),
    );
    expect(useCompareStore.getState().ids).toEqual([]);
  });

  it("tells assistive technology about the key", () => {
    renderWithClient(<CompareLink id="bitcoin" name="Bitcoin" />);
    expect(screen.getByRole("link")).toHaveAttribute("aria-keyshortcuts", "A");
  });
});
