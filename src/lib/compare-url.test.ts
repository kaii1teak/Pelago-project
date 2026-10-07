import { describe, expect, it } from "vitest";
import { sameIds, withAssets } from "./compare-url";

describe("withAssets", () => {
  it("writes the selection, with commas left readable", () => {
    expect(withAssets("", ["bitcoin", "ethereum"])).toBe("?assets=bitcoin,ethereum");
  });

  it("returns an empty string for no assets and no other params", () => {
    expect(withAssets("", [])).toBe("");
    expect(withAssets("?assets=bitcoin", [])).toBe("");
  });

  it("replaces a previous selection", () => {
    expect(withAssets("?assets=old", ["a", "b"])).toBe("?assets=a,b");
  });

  it("keeps the range, and always puts it after the assets (one state, one URL)", () => {
    expect(withAssets("?range=30d", ["a"])).toBe("?assets=a&range=30d");
    expect(withAssets("?range=30d&assets=x", ["a", "b"])).toBe("?assets=a,b&range=30d");
    expect(withAssets("?assets=x&range=1y", ["a"])).toBe("?assets=a&range=1y");
  });

  it("keeps the range even when no assets are selected", () => {
    expect(withAssets("?assets=a&range=24h", [])).toBe("?range=24h");
  });

  it("leaves unrelated params ahead of both", () => {
    expect(withAssets("?ref=home&range=7d", ["a"])).toBe("?ref=home&assets=a&range=7d");
  });

  it("is stable: writing the same selection twice gives the same URL", () => {
    const once = withAssets("?range=30d", ["a", "b"]);
    expect(withAssets(once, ["a", "b"])).toBe(once);
  });
});

describe("sameIds", () => {
  it("compares order and content", () => {
    expect(sameIds(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameIds(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameIds(["a"], ["a", "b"])).toBe(false);
    expect(sameIds([], [])).toBe(true);
  });
});
