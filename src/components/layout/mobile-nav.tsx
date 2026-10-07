"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RowIndex } from "@/components/ui/row-index";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NAV_LINKS, isActivePath } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden [&_svg]:size-6"
          aria-label="Open menu"
        >
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent title="Menu" description="Site navigation">
        <div className="mb-10 pt-1">
          <Wordmark />
        </div>
        <nav aria-label="Mobile">
          <ul className="border-t border-primary">
            {NAV_LINKS.map((link, i) => {
              const active = isActivePath(pathname, link);
              return (
                <li key={link.href} className="border-b border-primary">
                  {/* Closing on click: the sheet would otherwise stay open over the new page. */}
                  <SheetClose asChild>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-16 items-center justify-between px-1 text-heading-sm transition-colors duration-150 ease-standard hover:bg-overlay-subtle",
                        active ? "text-primary" : "text-secondary",
                      )}
                    >
                      {link.label}
                      <RowIndex n={i + 1} />
                    </Link>
                  </SheetClose>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
