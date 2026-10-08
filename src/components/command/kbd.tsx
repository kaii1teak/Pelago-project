import { cn } from "@/lib/utils";

/** A keycap, for shortcut hints. Decorative: the real shortcut is on the control's aria-keyshortcuts. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-control border border-primary px-1.5 py-0.5 num text-mono-sm text-muted",
        className,
      )}
      {...props}
    />
  );
}
