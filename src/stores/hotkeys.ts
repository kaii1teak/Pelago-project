import { create } from "zustand";
import { persist } from "zustand/middleware";

export const HOTKEYS_STORAGE_KEY = "pelago-hotkeys";

type HotkeysState = {
  /**
   * Whether the keyboard shortcuts work at all. Single-character shortcuts must be
   * possible to turn off (WCAG 2.1.4): they clash with speech input and with screen
   * readers' own keys. Ctrl/Cmd+K stays on either way.
   */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;

  /** The keys of a sequence typed so far ("g"), while the next one is awaited. */
  pending: string[] | null;
  setPending: (pending: string[] | null) => void;

  /** The shortcuts overlay. `opener` is what had focus, so closing can hand it back. */
  overlayOpen: boolean;
  opener: HTMLElement | null;
  openOverlay: () => void;
  setOverlayOpen: (open: boolean) => void;
};

function focusedElement() {
  const el = document.activeElement;
  return el instanceof HTMLElement && el !== document.body ? el : null;
}

/**
 * `enabled` is saved in localStorage. `skipHydration`, as in the other stores: the server
 * renders the default, and <StoreHydrator /> reads the saved value after mount.
 */
export const useHotkeysStore = create<HotkeysState>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (enabled) => set({ enabled }),
      pending: null,
      setPending: (pending) => set({ pending }),
      overlayOpen: false,
      opener: null,
      openOverlay: () =>
        set((s) => ({
          overlayOpen: true,
          opener: s.overlayOpen ? s.opener : focusedElement(),
        })),
      setOverlayOpen: (open) =>
        set((s) => ({
          overlayOpen: open,
          opener: open && !s.overlayOpen ? focusedElement() : s.opener,
        })),
    }),
    {
      name: HOTKEYS_STORAGE_KEY,
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ enabled: s.enabled }),
      // Stored data is user-editable text: only a real boolean counts.
      merge: (persisted, current) => {
        const enabled = (persisted as { enabled?: unknown } | null)?.enabled;
        return {
          ...current,
          enabled: typeof enabled === "boolean" ? enabled : current.enabled,
        };
      },
    },
  ),
);
