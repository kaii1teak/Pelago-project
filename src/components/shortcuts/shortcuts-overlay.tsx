"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GROUPS,
  GROUP_LABEL,
  GROUP_NOTE,
  HOTKEYS,
  type HotkeyGroup,
} from "@/lib/hotkeys/catalog";
import { cn } from "@/lib/utils";
import { useHotkeysStore } from "@/stores/hotkeys";
import { ShortcutKeys } from "./shortcut-keys";

/**
 * Every shortcut, grouped, opened with "?" (or from the footer and the palette). Also where
 * they are switched off and on again, which WCAG 2.1.4 asks of single-key shortcuts.
 * A Radix dialog: focus is trapped inside, Escape closes, and focus goes back to what
 * opened it.
 */
export function ShortcutsOverlay() {
  const open = useHotkeysStore((s) => s.overlayOpen);
  const setOpen = useHotkeysStore((s) => s.setOverlayOpen);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          // Radix only hands focus back for a Dialog.Trigger; this opens from a key too.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const { opener } = useHotkeysStore.getState();
            if (opener?.isConnected) opener.focus();
          }}
          className={cn(
            "fixed top-[6vh] left-1/2 z-50 flex max-h-[88dvh] w-[min(46rem,calc(100vw-2rem))] -translate-x-1/2 flex-col",
            "border border-strong surface-glass shadow-dropdown focus:outline-none",
            "data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in",
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-primary px-6 py-5">
            <div className="space-y-1">
              <Dialog.Title className="text-heading-sm text-primary">
                Keyboard shortcuts
              </Dialog.Title>
              <Dialog.Description className="text-body-md text-secondary">
                Everything here can also be done with the mouse.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Switch: single-key shortcuts clash with some assistive technology and speech input. */}
          <EnableSwitch />

          {/* tabIndex -1: Chrome makes a scrolling box a Tab stop, which would trap focus here. */}
          <div tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-x-10 gap-y-2 sm:grid-cols-2">
              {GROUPS.map((group) => (
                <Group key={group} group={group} />
              ))}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EnableSwitch() {
  const enabled = useHotkeysStore((s) => s.enabled);
  const setEnabled = useHotkeysStore((s) => s.setEnabled);

  return (
    <div className="flex shrink-0 items-center justify-between gap-6 border-b border-primary px-6 py-4">
      <div className="space-y-1">
        <p id="hotkeys-switch-label" className="text-body-md font-medium text-primary">
          Single-key shortcuts
        </p>
        <p id="hotkeys-switch-hint" className="text-body-sm text-secondary">
          Turn them off if they get in the way of a screen reader or voice control. Ctrl
          or ⌘ + K always works.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby="hotkeys-switch-label"
        aria-describedby="hotkeys-switch-hint"
        onClick={() => setEnabled(!enabled)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-fast ease-standard",
          enabled ? "border-transparent bg-btn-primary" : "border-outline bg-secondary",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-0.5 left-0.5 size-4.5 rounded-full transition-transform duration-base ease-spring",
            enabled ? "translate-x-5 bg-btn-primary-text" : "bg-muted translate-x-0",
          )}
        />
        <span className="sr-only">{enabled ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

function Group({ group }: { group: HotkeyGroup }) {
  const id = `shortcut-group-${group}`;
  const list = HOTKEYS.filter((h) => h.group === group);
  return (
    <section aria-labelledby={id} className="py-4">
      <h3 id={id} className="label-mono text-muted">
        {GROUP_LABEL[group]}
      </h3>
      {GROUP_NOTE[group] && (
        <p className="mt-1 text-body-sm text-secondary">{GROUP_NOTE[group]}</p>
      )}
      <ul className="divide-primary mt-3 divide-y border-y border-primary">
        {list.map((hotkey) => (
          <li key={hotkey.id} className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-body-md text-primary">{hotkey.description}</span>
            <ShortcutKeys id={hotkey.id} className="shrink-0" />
          </li>
        ))}
      </ul>
    </section>
  );
}
