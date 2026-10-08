"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HotkeyTip } from "@/components/shortcuts/hotkey-tip";
import { Tooltip } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Tooltip content={<HotkeyTip label="Toggle dark theme" id="theme" />}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dark theme"
        aria-pressed={theme === "dark"}
        aria-keyshortcuts="T"
        onClick={toggleTheme}
        className="[&_svg]:size-6"
      >
        {/* Both icons are always in the DOM and CSS picks one from <html class="dark">,
            so the right icon shows from first paint with no hydration flicker. */}
        <Sun className="dark:hidden" aria-hidden="true" />
        <Moon className="hidden dark:block" aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}
