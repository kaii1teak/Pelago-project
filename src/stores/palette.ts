import { create } from "zustand";

type PaletteState = {
  open: boolean;
  /** What had focus when the palette opened, so closing can hand it back. */
  opener: HTMLElement | null;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

/** The element that has focus right now, unless that is just the page itself. */
function focusedElement() {
  const el = document.activeElement;
  return el instanceof HTMLElement && el !== document.body ? el : null;
}

/**
 * Whether the command palette is showing. Not persisted: it always starts closed.
 * `opener` is remembered by the store (not the dialog) because the palette opens
 * from a keyboard shortcut and from buttons alike, and Radix only restores focus
 * for a Dialog.Trigger.
 */
export const usePaletteStore = create<PaletteState>()((set) => ({
  open: false,
  opener: null,
  setOpen: (open) =>
    set((s) => ({ open, opener: open && !s.open ? focusedElement() : s.opener })),
  toggle: () =>
    set((s) => ({ open: !s.open, opener: !s.open ? focusedElement() : s.opener })),
}));
