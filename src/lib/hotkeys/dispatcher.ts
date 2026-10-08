import { HOTKEYS, type HotkeyDef, type HotkeyId } from "./catalog";
import { matchesChord, parseKeys, type Chord } from "./keys";
import { isDialogOpen, isTypingTarget } from "./target";

/** Returns false when it turned out not to apply: the key then keeps its normal meaning. */
export type HotkeyHandler = (event: KeyboardEvent) => boolean | void;

type Entry = { def: HotkeyDef; chords: Chord[] };

export type DispatcherOptions = {
  /** Whether single-key shortcuts are switched on (the user can turn them off). */
  isEnabled: () => boolean;
  /** Told what has been typed of a sequence so far ("g"), or null when none is pending. */
  onPending?: (pending: string[] | null) => void;
  /** How long a sequence waits for its next key. */
  sequenceMs?: number;
  isTyping?: (target: EventTarget | null) => boolean;
  isDialogOpen?: () => boolean;
};

const SEQUENCE_MS = 1000;

/**
 * One keydown listener's worth of logic, kept out of React so it can be tested alone.
 *
 * Components register a handler for a catalog id; the dispatcher turns key events into
 * calls. Only shortcuts that have a handler right now take a key, so "1" is just "1" on a
 * page that has no chart ranges. Single keys are ignored while typing in a field, while a
 * dialog is open, with Ctrl/Alt/Cmd held (those belong to the browser), while the user
 * has them switched off, and while an input method is composing text.
 */
export class HotkeyDispatcher {
  private handlers = new Map<HotkeyId, HotkeyHandler[]>();
  private entries: Entry[] = HOTKEYS.map((def) => ({ def, chords: parseKeys(def.keys) }));
  private pending: Chord[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private options: DispatcherOptions) {}

  /** Registers a handler; the most recently registered one for an id answers. Returns the undo. */
  register(id: HotkeyId, handler: HotkeyHandler): () => void {
    const list = this.handlers.get(id) ?? [];
    list.push(handler);
    this.handlers.set(id, list);
    return () => {
      const current = this.handlers.get(id) ?? [];
      const index = current.indexOf(handler);
      if (index >= 0) current.splice(index, 1);
      if (current.length === 0) this.handlers.delete(id);
    };
  }

  /** Drops a half-typed sequence (a click, a dialog opening, the page changing). */
  reset() {
    this.pending = [];
    clearTimeout(this.timer);
    this.options.onPending?.(null);
  }

  dispose() {
    this.reset();
    this.handlers.clear();
  }

  handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    // A lone modifier press is not a shortcut, and must not cancel a pending sequence.
    if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;

    const typing = (this.options.isTyping ?? isTypingTarget)(event.target);
    const dialog = (this.options.isDialogOpen ?? isDialogOpen)();
    const enabled = this.options.isEnabled();
    const usable = (def: HotkeyDef) =>
      this.handlers.has(def.id as HotkeyId) &&
      (enabled || def.always === true) &&
      (!typing || def.allowInInput === true) &&
      (!dialog || def.inDialog === true) &&
      (!event.repeat || def.repeat === true);

    // 1. Continue a sequence that is waiting for its next key.
    if (this.pending.length > 0) {
      const depth = this.pending.length;
      const next = this.entries.filter(
        (e) =>
          e.chords.length > depth &&
          usable(e.def) &&
          this.pending.every((chord, i) => sameChord(chord, e.chords[i]!)) &&
          matchesChord(event, e.chords[depth]!),
      );
      const done = next.find((e) => e.chords.length === depth + 1);
      if (done) {
        this.reset();
        this.run(done.def, event);
        return;
      }
      if (next.length > 0) {
        this.pending = [...this.pending, next[0]!.chords[depth]!];
        this.arm();
        event.preventDefault();
        return;
      }
      // Not what the sequence wanted: forget it, and read this key afresh.
      this.reset();
    }

    // 2. A fresh key: a one-key shortcut, or the start of a sequence.
    const fresh = this.entries.filter(
      (e) => usable(e.def) && matchesChord(event, e.chords[0]!),
    );
    const single = fresh.find((e) => e.chords.length === 1);
    if (single) {
      this.run(single.def, event);
      return;
    }
    const starter = fresh.find((e) => e.chords.length > 1);
    if (starter) {
      this.pending = [starter.chords[0]!];
      this.arm();
      event.preventDefault();
    }
  };

  private arm() {
    clearTimeout(this.timer);
    this.options.onPending?.(this.pending.map((c) => c.key));
    this.timer = setTimeout(() => this.reset(), this.options.sequenceMs ?? SEQUENCE_MS);
  }

  private run(def: HotkeyDef, event: KeyboardEvent) {
    const handler = this.handlers.get(def.id as HotkeyId)?.at(-1);
    if (!handler) return;
    if (handler(event) !== false) event.preventDefault();
  }
}

const sameChord = (a: Chord, b: Chord) => a.key === b.key && a.mod === b.mod;
