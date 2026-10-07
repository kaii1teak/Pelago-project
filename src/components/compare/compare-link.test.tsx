import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useCompareStore } from "@/stores/compare";
import { CompareLink } from "./compare-link";

beforeEach(() => {
  localStorage.clear();
  useCompareStore.setState({ ids: [] });
});

describe("CompareLink", () => {
  it("is a link to the comparison, named for the asset it adds", () => {
    render(<CompareLink id="bitcoin" name="Bitcoin" />);
    expect(
      screen.getByRole("link", { name: "Compare Bitcoin with other assets" }),
    ).toHaveAttribute("href", "/compare");
  });

  it("adds the asset to the saved selection when followed", async () => {
    render(<CompareLink id="bitcoin" name="Bitcoin" />);
    await userEvent.click(screen.getByRole("link"));
    expect(useCompareStore.getState().ids).toEqual(["bitcoin"]);
  });

  it("joins what is already being compared instead of replacing it", async () => {
    useCompareStore.setState({ ids: ["ethereum"] });
    render(<CompareLink id="bitcoin" name="Bitcoin" />);
    await userEvent.click(screen.getByRole("link"));
    expect(useCompareStore.getState().ids).toEqual(["ethereum", "bitcoin"]);
  });

  it("does not duplicate an asset that is already there", async () => {
    useCompareStore.setState({ ids: ["bitcoin"] });
    render(<CompareLink id="bitcoin" name="Bitcoin" />);
    await userEvent.click(screen.getByRole("link"));
    expect(useCompareStore.getState().ids).toEqual(["bitcoin"]);
  });

  it("still opens the comparison when it is full, without pushing anything out", async () => {
    useCompareStore.setState({ ids: ["a", "b", "c", "d"] });
    render(<CompareLink id="bitcoin" name="Bitcoin" />);
    await userEvent.click(screen.getByRole("link"));
    expect(useCompareStore.getState().ids).toEqual(["a", "b", "c", "d"]);
  });
});
