import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function Example({ onValueChange }: { onValueChange?: (v: string) => void }) {
  return (
    <Tabs defaultValue="7d" onValueChange={onValueChange}>
      <TabsList aria-label="Range">
        <TabsTrigger value="24h">24h</TabsTrigger>
        <TabsTrigger value="7d">7d</TabsTrigger>
        <TabsTrigger value="30d">30d</TabsTrigger>
      </TabsList>
      <TabsContent value="24h">day view</TabsContent>
      <TabsContent value="7d">week view</TabsContent>
      <TabsContent value="30d">month view</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("exposes a tablist with the default tab selected", () => {
    render(<Example />);
    expect(screen.getByRole("tablist", { name: "Range" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "7d" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("week view")).toBeVisible();
  });

  it("switches on click and reports the change", async () => {
    const onValueChange = vi.fn();
    render(<Example onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "30d" }));
    expect(onValueChange).toHaveBeenCalledWith("30d");
    expect(screen.getByRole("tab", { name: "30d" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("month view")).toBeVisible();
    expect(screen.queryByText("week view")).toBeNull();
  });

  it("moves between tabs with the arrow keys (roving focus)", async () => {
    render(<Example />);
    await userEvent.tab();
    expect(screen.getByRole("tab", { name: "7d" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "30d" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "24h" })).toHaveFocus();
  });

  it("can be controlled", async () => {
    const onValueChange = vi.fn();
    render(
      <Tabs value="24h" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="24h">24h</TabsTrigger>
          <TabsTrigger value="7d">7d</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    await userEvent.click(screen.getByRole("tab", { name: "7d" }));
    expect(onValueChange).toHaveBeenCalledWith("7d");
    // Parent didn't update `value`, so the selection must not move on its own.
    expect(screen.getByRole("tab", { name: "24h" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
