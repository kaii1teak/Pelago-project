import { describe, expect, it } from "vitest";
import { sameIds, viewFrom, withAssets, withView } from "./compare-url";

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

describe("withView", () => {
  it("records the price view, and leaves the default out", () => {
    expect(withView("", "price")).toBe("?view=price");
    expect(withView("?view=price", "change")).toBe("");
  });

  it("sits between the assets and the range, whichever was written last", () => {
    expect(withView("?assets=a,b&range=30d", "price")).toBe(
      "?assets=a,b&view=price&range=30d",
    );
    expect(withAssets("?view=price&range=30d", ["a"])).toBe(
      "?assets=a&view=price&range=30d",
    );
    expect(withAssets("?range=1y&view=price&assets=x", ["a", "b"])).toBe(
      "?assets=a,b&view=price&range=1y",
    );
  });

  it("is stable: writing the same state twice gives the same URL", () => {
    const once = withView(withAssets("?range=7d", ["a", "b"]), "price");
    expect(withView(once, "price")).toBe(once);
    expect(withAssets(once, ["a", "b"])).toBe(once);
  });

  it("leaves other parameters ahead of the page's own", () => {
    expect(withView("?ref=home&range=7d", "price")).toBe("?ref=home&view=price&range=7d");
  });
});

describe("viewFrom", () => {
  it("reads the view, falling back to change for anything unknown", () => {
    expect(viewFrom("?view=price")).toBe("price");
    expect(viewFrom("?view=change")).toBe("change");
    expect(viewFrom("?view=bogus")).toBe("change");
    expect(viewFrom("")).toBe("change");
    expect(viewFrom(new URLSearchParams("view=price"))).toBe("price");
  });
});
