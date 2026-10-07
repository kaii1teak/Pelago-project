import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** For "nothing here yet / nothing matches" (not for errors, see ErrorState). */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  as: Heading = "h3",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Usually one <Button> or a button-styled <Link>. */
  action?: React.ReactNode;
  /** Match the page's outline: h2 right under the page's h1, h3 inside a section. */
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-control border border-strong text-secondary">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="max-w-sm space-y-1">
        <Heading className="text-heading-xs text-primary">{title}</Heading>
        {description && <p className="text-body-md text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
