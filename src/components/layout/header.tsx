"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandTrigger } from "@/components/command/command-trigger";
import { NAV_LINKS, isActivePath } from "@/lib/site";
import { cn } from "@/lib/utils";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

/** Flat sticky bar: page background, hairline underneath, nothing that blurs or glows. */
export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-primary bg-primary">
      <div className="page-container flex h-full items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Pelago home" className="rounded-control">
            <Wordmark />
          </Link>

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-6">
              {NAV_LINKS.map((link) => {
                const active = isActivePath(pathname, link);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex h-10 items-center rounded-control text-body-lg transition-colors duration-150 ease-standard",
                        active ? "text-primary" : "text-muted hover:text-primary",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <CommandTrigger />
          <ThemeToggle />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
