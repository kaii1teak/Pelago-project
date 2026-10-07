export const SITE = {
  name: "Pelago",
  tagline: "The crypto market, at a glance.",
  description:
    "Live prices, charts and comparisons for the top crypto assets. A frontend portfolio project built with Next.js.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
} as const;

export type NavLink = {
  href: string;
  label: string;
  /** Extra path prefixes that should also mark this link as current. */
  matches?: string[];
};

export const NAV_LINKS: NavLink[] = [
  { href: "/markets", label: "Markets", matches: ["/coin"] },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/compare", label: "Compare" },
];

export function isActivePath(pathname: string, link: NavLink) {
  return [link.href, ...(link.matches ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
