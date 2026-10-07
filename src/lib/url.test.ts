import { describe, expect, it } from "vitest";
import { hostnameOf, safeUrl } from "./url";

describe("safeUrl", () => {
  it("accepts http and https", () => {
    expect(safeUrl("https://bitcoin.org/bitcoin.pdf")).toBe(
      "https://bitcoin.org/bitcoin.pdf",
    );
    expect(safeUrl("http://www.bitcoin.org")).toBe("http://www.bitcoin.org/");
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:x",
    "file:///etc/passwd",
    "//evil.example",
    "not a url",
    "",
    "   ",
  ])("rejects %j", (value) => {
    expect(safeUrl(value)).toBeNull();
  });

  it("rejects non-strings and absurdly long values", () => {
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
    expect(safeUrl(42)).toBeNull();
    expect(safeUrl({})).toBeNull();
    expect(safeUrl(`https://x.test/${"a".repeat(400)}`)).toBeNull();
  });
});

describe("hostnameOf", () => {
  it("shows a clean hostname", () => {
    expect(hostnameOf("https://www.bitcoin.org/en/")).toBe("bitcoin.org");
    expect(hostnameOf("https://mempool.space/")).toBe("mempool.space");
  });
});
