import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COLOR_NAMES, FONT_SIZES, cn } from "./utils";

describe("cn: design-system classes", () => {
  it("keeps a custom font size alongside a text color (the bug this exists to prevent)", () => {
    expect(cn("text-heading-md", "text-primary")).toBe("text-heading-md text-primary");
    expect(cn("text-mono-md text-secondary")).toBe("text-mono-md text-secondary");
    expect(cn("num text-mono-md", "text-primary")).toBe("num text-mono-md text-primary");
  });

  it("a later size replaces an earlier size", () => {
    expect(cn("text-body-md", "text-body-lg")).toBe("text-body-lg");
    expect(cn("text-heading-xl text-primary", "text-heading-md")).toBe(
      "text-primary text-heading-md",
    );
  });

  it("a later color replaces an earlier color", () => {
    expect(cn("text-muted", "text-primary")).toBe("text-primary");
    expect(cn("text-secondary hover:text-muted", "text-primary")).toBe(
      "hover:text-muted text-primary",
    );
  });

  it("resolves background and border color conflicts", () => {
    expect(cn("bg-primary", "bg-inverse")).toBe("bg-inverse");
    expect(cn("bg-btn-secondary", "bg-btn-primary")).toBe("bg-btn-primary");
    expect(cn("border-primary", "border-strong")).toBe("border-strong");
  });

  it("does not confuse border width with border color", () => {
    expect(cn("border border-primary")).toBe("border border-primary");
    expect(cn("border-t border-primary")).toBe("border-t border-primary");
  });

  it("does not mix up a size, a color and an alignment", () => {
    expect(cn("text-center text-body-lg text-secondary")).toBe(
      "text-center text-body-lg text-secondary",
    );
  });

  it("variants conflict only with their own variant", () => {
    expect(cn("text-muted hover:text-primary", "text-secondary")).toBe(
      "hover:text-primary text-secondary",
    );
  });

  it("still handles plain Tailwind classes and conditionals", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("h-9", false && "h-20", undefined, null, "h-20")).toBe("h-20");
  });
});

describe("cn: registered tokens stay in sync with globals.css", () => {
  const css = readFileSync(
    path.resolve(import.meta.dirname, "../app/globals.css"),
    "utf8",
  );
  const registeredColors = new Set<string>(COLOR_NAMES);
  const registeredSizes = new Set<string>(FONT_SIZES);

  it("every font-size token is registered", () => {
    const sizes = [...css.matchAll(/--text-((?:heading|body|mono)-[a-z0-9]+):/g)].map(
      (m) => m[1]!,
    );
    expect(sizes.length).toBeGreaterThan(10);
    for (const name of sizes) expect(registeredSizes, `text-${name}`).toContain(name);
  });

  it("every theme color is registered", () => {
    const colors = [...css.matchAll(/--color-([a-z0-9-]+):\s*var\(/g)].map((m) => m[1]!);
    expect(colors.length).toBeGreaterThan(30);
    for (const name of colors)
      expect(registeredColors, `--color-${name}`).toContain(name);
  });

  it("every semantic bg-/text-/border- utility is registered", () => {
    const utilities = [...css.matchAll(/@utility (?:bg|text|border)-([a-z]+) \{/g)].map(
      (m) => m[1]!,
    );
    expect(utilities.length).toBeGreaterThanOrEqual(14);
    for (const name of utilities)
      expect(registeredColors, `@utility *-${name}`).toContain(name);
  });
});
