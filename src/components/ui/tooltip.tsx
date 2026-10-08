"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/** Mount once near the root (see the root layout). Shares open-delay across tooltips. */
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={250} skipDelayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export type TooltipProps = {
  content: React.ReactNode;
  /** The element that triggers it. Must be focusable so keyboard users get it too. */
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
};

/**
 * Tooltips are supplementary: never put information in one that isn't available
 * elsewhere, because touch users can't hover.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-50 max-w-64 animate-fade-in rounded-control bg-inverse px-2 py-1 text-body-sm text-inverse shadow-dropdown data-[state=closed]:animate-fade-out",
            className,
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
