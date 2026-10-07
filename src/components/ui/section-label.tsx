import { cn } from "@/lib/utils";

/**
 * Mono micro-label with the "///" prefix used above sections, footer columns
 * and error pages: <SectionLabel>Markets</SectionLabel> renders "/// MARKETS".
 * (Written as a component, not raw JSX text, because "//" in JSX children
 * looks like a comment to the linter.)
 */
export function SectionLabel({
  as: Tag = "p",
  className,
  children,
}: {
  as?: "p" | "h2" | "h3";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag className={cn("label-mono text-muted", className)}>
      {"/// "}
      {children}
    </Tag>
  );
}
