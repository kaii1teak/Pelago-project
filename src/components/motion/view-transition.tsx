import * as React from "react";

/**
 * React's `<ViewTransition>`, which animates between two states of the page with the
 * browser's View Transitions API. The Next.js App Router bundles the React build that
 * has it; plain React (our unit tests, which render without Next) does not, and there
 * it is a pass-through: same children, no animation.
 */
const Native: typeof React.ViewTransition | undefined = React.ViewTransition;

function PassThrough({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export const ViewTransition: typeof React.ViewTransition =
  Native ?? (PassThrough as unknown as typeof React.ViewTransition);

/**
 * Transition types for <Link transitionTypes={[...]}>: which way a navigation goes.
 * They pick the slide direction in globals.css; a navigation without one (the back
 * button, a header link) just crossfades.
 */
export const NAV_FORWARD = "nav-forward";
export const NAV_BACK = "nav-back";

/** The route-change animation: class names that globals.css styles (see "View transitions"). */
export const PAGE_TRANSITION = {
  [NAV_FORWARD]: "nav-forward",
  [NAV_BACK]: "nav-back",
  default: "page-fade",
} as const;
