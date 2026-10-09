import {cn} from "@/lib/utils";

/**
 * The Pelago mark: a solid square cut by one rising diagonal, a price line seen as
 * a gap. Flat, two shapes, in the current text color, so it follows the theme
 * without any color of its own. Keep it in step with `src/app/icon.svg`.
 */
export function LogoMark({className}: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className={cn("shrink-0", className)}
        >
            <path d="M2 2H20L2 20Z"/>
            <path d="M22 4V22H4Z"/>
        </svg>
    );
}

export function Wordmark({className}: { className?: string }) {
    return (
        <span className={cn("inline-flex items-center gap-1 text-primary", className)}>
      <LogoMark className="size-6"/>
      <span className="text-heading-sm">Pelago</span>
    </span>
    );
}
