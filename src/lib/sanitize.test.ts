import { describe, expect, it } from "vitest";
import { htmlToParagraphs } from "./sanitize";

describe("htmlToParagraphs", () => {
  it("strips tags but keeps their text", () => {
    expect(
      htmlToParagraphs('A <a href="https://x.test">link</a> and <b>bold</b>.'),
    ).toEqual(["A link and bold."]);
  });

  it("removes script and style blocks together with their contents", () => {
    const out = htmlToParagraphs(
      "Safe<script>alert('x')</script> text<style>body{display:none}</style>.",
    );
    expect(out).toEqual(["Safe text."]);
    expect(out.join("")).not.toMatch(/alert|display/);
  });

  it("neutralizes hostile markup (it can only ever become text)", () => {
    const out = htmlToParagraphs(
      '<img src=x onerror="alert(1)"><svg onload=alert(1)>hi</svg>',
    );
    expect(out).toEqual(["hi"]);
  });

  it("turns <br> and block closings into paragraph breaks", () => {
    expect(htmlToParagraphs("One<br><br>Two")).toEqual(["One", "Two"]);
    expect(htmlToParagraphs("<p>One</p><p>Two</p>")).toEqual(["One", "Two"]);
  });

  it("splits on blank lines and collapses other whitespace", () => {
    expect(htmlToParagraphs("One\r\n\r\nTwo   words\nstill two")).toEqual([
      "One",
      "Two words still two",
    ]);
  });

  it("decodes common entities exactly once", () => {
    expect(htmlToParagraphs("Fish &amp; chips &lt;3 &quot;q&quot;")).toEqual([
      'Fish & chips <3 "q"',
    ]);
    // double-encoded stays as literal text instead of becoming a tag
    expect(htmlToParagraphs("&amp;lt;script&amp;gt;")).toEqual(["&lt;script&gt;"]);
  });

  it("handles missing and empty input", () => {
    expect(htmlToParagraphs(null)).toEqual([]);
    expect(htmlToParagraphs(undefined)).toEqual([]);
    expect(htmlToParagraphs("")).toEqual([]);
    expect(htmlToParagraphs("   <br>  ")).toEqual([]);
  });
});
