import { cn } from "@/lib/utils";

export type InputProps = React.ComponentProps<"input"> & {
  /** Decorative leading icon (e.g. a search glass). */
  icon?: React.ReactNode;
};

/**
 * 1px control border (the form-field edge must reach 3:1), 2px radius, info-color
 * border on focus plus the global focus ring. Always give it an accessible name:
 * a visible <label>, or aria-label.
 */
export function Input({ className, icon, ...props }: InputProps) {
  return (
    <div className="relative">
      {icon && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted [&_svg]:size-4"
        >
          {icon}
        </span>
      )}
      <input
        className={cn(
          "h-10 w-full rounded-control border border-control bg-primary text-body-md text-primary",
          "placeholder:text-muted",
          "transition-colors duration-150 ease-standard",
          "hover:bg-overlay-subtle focus-visible:border-info",
          icon ? "pr-3 pl-9" : "px-3",
          className,
        )}
        {...props}
      />
    </div>
  );
}
