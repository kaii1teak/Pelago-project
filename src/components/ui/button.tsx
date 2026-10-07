import { LoaderCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Exported so links can look like buttons: <Link className={buttonVariants({...})}>.
 * That keeps navigation as real <a> elements instead of <button onClick={router.push}>.
 *
 * Flat by design: 2px radius, no shadow, state changes are color-only (0.15s).
 */
export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap select-none",
    "rounded-control transition-colors duration-150 ease-standard",
    "disabled:pointer-events-none disabled:text-disabled aria-disabled:pointer-events-none aria-disabled:text-disabled",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-btn-primary font-semibold text-btn-primary-text hover:bg-btn-primary-hover active:bg-btn-primary-hover disabled:bg-btn-secondary aria-disabled:bg-btn-secondary",
        secondary:
          "bg-btn-secondary font-medium text-primary hover:bg-btn-secondary-hover active:bg-btn-secondary-pressed",
        outline:
          "border border-outline font-medium text-primary hover:border-outline-hover active:border-outline-pressed",
        ghost: "font-medium text-secondary hover:bg-overlay-subtle hover:text-primary",
      },
      size: {
        sm: "h-8 px-2.5 text-body-md",
        md: "h-9 px-3 text-body-md",
        lg: "h-11 px-4 text-body-lg",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner and blocks interaction. The label stays so the width doesn't jump. */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
