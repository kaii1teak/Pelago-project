import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * A flat bordered container: no radius, no shadow, no glass. Most of the app
 * uses hairline-separated rows instead; this is for the few places that need an
 * outlined region (empty/error states, the styleguide).
 */
const cardVariants = cva("border border-primary bg-primary", {
  variants: {
    padding: { none: "", sm: "p-4", md: "p-6", lg: "p-8" },
    /** Highlights on hover. Use for cards that are (or contain) a link. */
    interactive: {
      true: "transition-colors duration-150 ease-standard hover:bg-overlay-hover",
      false: "",
    },
  },
  defaultVariants: { padding: "md", interactive: false },
});

export type CardProps = React.ComponentProps<"div"> & VariantProps<typeof cardVariants>;

export function Card({ className, padding, interactive, ...props }: CardProps) {
  return (
    <div className={cn(cardVariants({ padding, interactive }), className)} {...props} />
  );
}
