import { cn } from "@/lib/utils";
import { SectionLabel } from "./section-label";

/**
 * Section header: a mono label ("/// MARKETS"), a light heading with tight
 * tracking, and an optional description and action.
 */
export function SectionHeading({
  id,
  label,
  title,
  description,
  action,
  className,
  as: Heading = "h2",
}: {
  /** Put on the heading so the parent <section> can aria-labelledby it. */
  id?: string;
  /** Rendered as "/// LABEL". */
  label?: string;
  title: string;
  description?: string;
  /** Right-aligned slot, usually a "View all" link. */
  action?: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-8 gap-y-4",
        className,
      )}
    >
      <div className="max-w-2xl space-y-4">
        {label && <SectionLabel>{label}</SectionLabel>}
        <Heading id={id} className="text-heading-lg text-primary">
          {title}
        </Heading>
        {description && <p className="text-body-lg text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
