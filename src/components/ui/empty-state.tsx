import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** For "nothing here yet / nothing matches" (not for errors, see ErrorState). */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Usually one <Button> or a button-styled <Link>. */
  action?: React.ReactNode;
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
        <h3 className="text-heading-xs text-primary">{title}</h3>
        {description && <p className="text-body-md text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
