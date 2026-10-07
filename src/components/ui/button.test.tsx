import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it("renders its label and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("loading disables it, flags aria-busy, and keeps the label", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is reachable and activatable by keyboard", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("lets a caller's classes win over the variant's (tailwind-merge)", () => {
    render(<Button className="h-20">Tall</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("h-20");
    expect(button).not.toHaveClass("h-9");
  });
});

describe("buttonVariants", () => {
  it("can style a link as a button", () => {
    render(
      <a href="/markets" className={buttonVariants({ variant: "outline" })}>
        Markets
      </a>,
    );
    expect(screen.getByRole("link", { name: "Markets" })).toHaveClass("border-outline");
  });
});
