"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Side panel built on Radix Dialog: focus is trapped, Escape closes, focus
 * returns to the trigger, and the rest of the page is inert for screen readers.
 * Flat: a flat scrim (no blur), a hairline edge, no shadow.
 */

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** Required: the dialog's accessible name. Visually hidden. */
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[min(24rem,88vw)] flex-col",
          "border-l border-primary bg-primary p-6",
          "data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">
          {description ?? title}
        </DialogPrimitive.Description>
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-control text-secondary transition-colors duration-fast hover:bg-overlay-subtle hover:text-primary"
        >
          <X className="size-6" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
