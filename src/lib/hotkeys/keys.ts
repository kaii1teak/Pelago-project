/** One key press: a key, with or without the platform modifier (Cmd on Apple, Ctrl elsewhere). */
export type Chord = {
  /** A lower-case character ("g", "1", "?", "/") or a named key ("enter"). */
  key: string;
  mod: boolean;
};

const NAMED = new Set(["enter", "escape", "tab", "space"]);

/** "mod+k" -> {key: "k", mod: true}; "?" -> {key: "?", mod: false}. */
export function parseChord(text: string): Chord {
  const parts = text.split("+");
  const key = parts.pop()!;
  const mod = parts.includes("mod");
  const lower = key.toLowerCase();
  return { key: NAMED.has(lower) ? lower : key.length === 1 ? lower : key, mod };
}

/** "g h" -> [g, h]. */
export const parseKeys = (keys: string): Chord[] =>
  keys.split(" ").filter(Boolean).map(parseChord);

const isLetter = (key: string) => /^[a-z]$/.test(key);
const isDigit = (key: string) => /^[0-9]$/.test(key);

/**
 * Whether a key event is this chord.
 *
 * - Letters match by what the key SAYS, so they follow the layout (Dvorak, AZERTY). Only
 *   when the key says something that isn't a Latin letter (the Russian or Ukrainian
 *   layout types "о" where QWERTY has "j") do they fall back to where the key SITS.
 * - Digits likewise, with the same fallback for layouts where 1 needs Shift (AZERTY).
 * - Letters and digits never match with Shift held: Shift+G is another shortcut's business.
 * - Punctuation ("?", "/") matches by character only: which key types it, and whether
 *   Shift is needed, differs by layout.
 * - Without `mod` the chord needs Ctrl, Meta and Alt all up, so browser and system
 *   shortcuts (Ctrl+T, Cmd+J, Alt+Left) are never taken. With `mod`, exactly Ctrl or Meta.
 */
export function matchesChord(event: KeyboardEvent, chord: Chord): boolean {
  const mod = event.ctrlKey || event.metaKey;
  if (event.altKey) return false;
  if (chord.mod ? !mod : mod) return false;

  const { key: typed, code } = event;
  const { key } = chord;

  if (isLetter(key)) {
    if (event.shiftKey) return false;
    if (typed.length === 1 && isLetter(typed.toLowerCase()))
      return typed.toLowerCase() === key;
    return code === `Key${key.toUpperCase()}`;
  }
  if (isDigit(key)) {
    if (event.shiftKey && typed === key) return false;
    if (typed === key) return true;
    return !isDigit(typed) && (code === `Digit${key}` || code === `Numpad${key}`);
  }
  if (NAMED.has(key)) {
    if (event.shiftKey) return false;
    return typed.toLowerCase() === key || (key === "space" && typed === " ");
  }
  return typed === key;
}

const NAMED_LABEL: Record<string, string> = {
  enter: "Enter",
  escape: "Esc",
  tab: "Tab",
  space: "Space",
};

/** The text on the keycaps for a chord: ["⌘", "K"] or ["Ctrl", "K"], ["G"], ["Enter"]. */
export function chordLabels(chord: Chord, mac: boolean): string[] {
  const labels: string[] = [];
  if (chord.mod) labels.push(mac ? "⌘" : "Ctrl");
  labels.push(NAMED_LABEL[chord.key] ?? chord.key.toUpperCase());
  return labels;
}

/** Whether this machine is an Apple device (Cmd rather than Ctrl). */
export const isMac = (platform: string) => /Mac|iPhone|iPad/i.test(platform);
