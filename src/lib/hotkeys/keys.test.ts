import { describe, expect, it } from "vitest";
import { HOTKEYS } from "./catalog";
import { chordLabels, isMac, matchesChord, parseChord, parseKeys } from "./keys";

const press = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

describe("parseChord / parseKeys", () => {
  it("reads keys, the modifier, named keys and sequences", () => {
    expect(parseChord("t")).toEqual({ key: "t", mod: false });
    expect(parseChord("mod+k")).toEqual({ key: "k", mod: true });
    expect(parseChord("Enter")).toEqual({ key: "enter", mod: false });
    expect(parseChord("?")).toEqual({ key: "?", mod: false });
    expect(parseKeys("g h")).toEqual([
      { key: "g", mod: false },
      { key: "h", mod: false },
    ]);
  });

  it("every shortcut in the catalog parses to at least one chord", () => {
    for (const def of HOTKEYS)
      expect(parseKeys(def.keys).length, def.id).toBeGreaterThan(0);
  });

  it("no two shortcuts use the same keys", () => {
    const keys = HOTKEYS.map((h) => h.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("a single key is never also the start of a sequence", () => {
    const singles = new Set<string>(
      HOTKEYS.filter((h) => !h.keys.includes(" ")).map((h) => h.keys),
    );
    for (const def of HOTKEYS.filter((h) => h.keys.includes(" "))) {
      expect(singles.has(def.keys.split(" ")[0]!), def.id).toBe(false);
    }
  });
});

describe("matchesChord: letters", () => {
  const t = parseChord("t");

  it("matches the character the key types", () => {
    expect(matchesChord(press({ key: "t", code: "KeyT" }), t)).toBe(true);
    expect(matchesChord(press({ key: "T", code: "KeyT", shiftKey: false }), t)).toBe(
      true,
    ); // caps lock
    expect(matchesChord(press({ key: "x", code: "KeyX" }), t)).toBe(false);
  });

  it("follows a Latin layout: a Dvorak key that types t is t, wherever it sits", () => {
    expect(matchesChord(press({ key: "t", code: "KeyK" }), t)).toBe(true);
    expect(matchesChord(press({ key: "k", code: "KeyT" }), t)).toBe(false);
  });

  it("falls back to the key's place on a layout that isn't Latin (Russian: е is where t is)", () => {
    expect(matchesChord(press({ key: "е", code: "KeyT" }), t)).toBe(true);
    expect(matchesChord(press({ key: "о", code: "KeyJ" }), parseChord("j"))).toBe(true);
    expect(matchesChord(press({ key: "л", code: "KeyK" }), parseChord("k"))).toBe(true);
    // Ukrainian types "і" on the S key
    expect(matchesChord(press({ key: "і", code: "KeyS" }), parseChord("s"))).toBe(true);
    expect(matchesChord(press({ key: "о", code: "KeyJ" }), t)).toBe(false);
  });

  it("is not Shift+letter", () => {
    expect(matchesChord(press({ key: "T", code: "KeyT", shiftKey: true }), t)).toBe(
      false,
    );
  });

  it("never takes browser or system chords: Ctrl, Meta or Alt held", () => {
    expect(matchesChord(press({ key: "t", code: "KeyT", ctrlKey: true }), t)).toBe(false);
    expect(matchesChord(press({ key: "t", code: "KeyT", metaKey: true }), t)).toBe(false);
    expect(matchesChord(press({ key: "t", code: "KeyT", altKey: true }), t)).toBe(false);
  });
});

describe("matchesChord: mod+k", () => {
  const palette = parseChord("mod+k");
  it("is Ctrl+K or Cmd+K, and only those", () => {
    expect(matchesChord(press({ key: "k", code: "KeyK", ctrlKey: true }), palette)).toBe(
      true,
    );
    expect(matchesChord(press({ key: "k", code: "KeyK", metaKey: true }), palette)).toBe(
      true,
    );
    expect(matchesChord(press({ key: "k", code: "KeyK" }), palette)).toBe(false);
    expect(
      matchesChord(
        press({ key: "k", code: "KeyK", ctrlKey: true, shiftKey: true }),
        palette,
      ),
    ).toBe(false);
    expect(
      matchesChord(
        press({ key: "k", code: "KeyK", ctrlKey: true, altKey: true }),
        palette,
      ),
    ).toBe(false);
  });

  it("works on the Russian layout too (Ctrl+Л)", () => {
    expect(matchesChord(press({ key: "л", code: "KeyK", ctrlKey: true }), palette)).toBe(
      true,
    );
  });
});

describe("matchesChord: digits and punctuation", () => {
  it("matches the digit, on the main row or the numpad", () => {
    const one = parseChord("1");
    expect(matchesChord(press({ key: "1", code: "Digit1" }), one)).toBe(true);
    expect(matchesChord(press({ key: "1", code: "Numpad1" }), one)).toBe(true);
    expect(matchesChord(press({ key: "2", code: "Digit2" }), one)).toBe(false);
  });

  it("matches 1 on a layout where the key needs Shift to type a digit (AZERTY)", () => {
    expect(matchesChord(press({ key: "&", code: "Digit1" }), parseChord("1"))).toBe(true);
    expect(
      matchesChord(press({ key: "1", code: "Digit1", shiftKey: true }), parseChord("1")),
    ).toBe(false);
  });

  it("matches ? and / by the character, whatever key and Shift produced it", () => {
    expect(
      matchesChord(press({ key: "?", code: "Slash", shiftKey: true }), parseChord("?")),
    ).toBe(true);
    expect(matchesChord(press({ key: "/", code: "Slash" }), parseChord("/"))).toBe(true);
    expect(
      matchesChord(press({ key: "/", code: "Digit7", shiftKey: true }), parseChord("/")),
    ).toBe(
      true, // German layout
    );
    expect(
      matchesChord(press({ key: "?", code: "Slash", shiftKey: true }), parseChord("/")),
    ).toBe(false);
  });

  it("matches Enter", () => {
    expect(
      matchesChord(press({ key: "Enter", code: "Enter" }), parseChord("Enter")),
    ).toBe(true);
    expect(
      matchesChord(
        press({ key: "Enter", code: "Enter", shiftKey: true }),
        parseChord("Enter"),
      ),
    ).toBe(false);
  });
});

describe("chordLabels / isMac", () => {
  it("labels the modifier for the platform", () => {
    expect(chordLabels(parseChord("mod+k"), true)).toEqual(["⌘", "K"]);
    expect(chordLabels(parseChord("mod+k"), false)).toEqual(["Ctrl", "K"]);
  });

  it("labels plain and named keys", () => {
    expect(chordLabels(parseChord("g"), false)).toEqual(["G"]);
    expect(chordLabels(parseChord("?"), false)).toEqual(["?"]);
    expect(chordLabels(parseChord("Enter"), false)).toEqual(["Enter"]);
  });

  it("knows Apple platforms", () => {
    expect(isMac("MacIntel")).toBe(true);
    expect(isMac("iPhone")).toBe(true);
    expect(isMac("Win32")).toBe(false);
    expect(isMac("Linux x86_64")).toBe(false);
  });
});
