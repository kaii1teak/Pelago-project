import { describe, expect, it } from "vitest";
import { CATEGORIES, categoryLabel, isCategoryId } from "./categories";

describe("categories", () => {
  it("accepts every curated id", () => {
    for (const c of CATEGORIES) expect(isCategoryId(c.id)).toBe(true);
  });

  it("rejects anything else, including well-formed slugs, non-strings and prototype keys", () => {
    for (const bad of [
      "made-up",
      "Layer-1",
      "",
      " layer-1",
      "constructor",
      "__proto__",
      null,
      undefined,
      7,
      {},
    ]) {
      expect(isCategoryId(bad)).toBe(false);
    }
  });

  it("has unique ids and labels", () => {
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(CATEGORIES.length);
    expect(new Set(CATEGORIES.map((c) => c.label)).size).toBe(CATEGORIES.length);
  });

  it("labels known ids and falls back to the id", () => {
    expect(categoryLabel("decentralized-finance-defi")).toBe("DeFi");
    expect(categoryLabel("unknown")).toBe("unknown");
  });
});
