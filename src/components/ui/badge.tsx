import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-control border px-1.5 py-0.5 num text-mono-sm whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border-primary text-secondary",
        accent: "border-transparent bg-accent-tint text-accent",
        gain: "border-transparent bg-success-tint text-success",
        loss: "border-transparent bg-critical-tint text-critical",
        outline: "border-strong text-secondary",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
