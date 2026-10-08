"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  GitCompareArrows,
  House,
  LoaderCircle,
  Keyboard,
  Moon,
  Search,
  Star,
  Sun,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CoinLogo } from "@/components/ui/coin-logo";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTheme } from "@/hooks/use-theme";
import { useMarkets, useSearch } from "@/lib/api/hooks";
import { normalizeSearchText } from "@/lib/api/parse-search";
import { MAX_SEARCH_RESULTS } from "@/lib/api/schemas";
import {
  buildGroups,
  flattenGroups,
  fromMarket,
  itemKey,
  matchScore,
  pageItems,
  searchAssets,
  type PaletteItem,
} from "@/lib/palette";
import { NAV_LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";
import { usePaletteStore } from "@/stores/palette";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import { useHotkeysStore } from "@/stores/hotkeys";
import { Kbd } from "./kbd";

const SEARCH_DEBOUNCE_MS = 250;
const PAGES = pageItems(NAV_LINKS);

const PAGE_ICON: Record<string, LucideIcon> = {
  "/": House,
  "/markets": TrendingUp,
  "/watchlist": Star,
  "/compare": GitCompareArrows,
};

/**
 * A command palette: jump to a page, switch the theme, or find any asset in the
 * market. Mounted once for the whole app. The dialog (focus trap, Escape, scroll ё
 * lock, restoring focus to what opened it) is Radix; the list is a WAI-ARIA
 * combobox over a listbox, with the input keeping focus throughout.
 */
export function CommandPalette() {
  const open = usePaletteStore((s) => s.open);
  const setOpen = usePaletteStore((s) => s.setOpen);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          // Closing hands focus back to whatever opened the palette (the header button,
          // or the field you were typing in). Choosing a page clears the opener first:
          // after a navigation, focus belongs to the new page.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const { opener } = usePaletteStore.getState();
            if (opener?.isConnected) opener.focus();
          }}
          className={cn(
            // Centered on wide screens at a FIXED height: a box that resized around its
            // centre would jump every time the number of results changed. On phones it
            // sits near the top instead, because the keyboard covers the lower half.
            "fixed top-[8vh] left-1/2 z-50 flex w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 flex-col",
            "h-[min(30rem,72dvh)] sm:top-1/2 sm:h-[min(34rem,calc(100dvh-4rem))] sm:-translate-y-1/2",
            // surface-glass (globals.css): see-through + blurred. Tune --glass-opacity / --glass-blur there.
            "border border-strong surface-glass shadow-dropdown focus:outline-none",
            "data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in",
          )}
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search assets and pages. Use the up and down arrow keys to move, Enter to
            open, and Escape to close.
          </Dialog.Description>
          {/* Only mounted while open, so every opening starts from an empty box. */}
          <PaletteBody onClose={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const top = useMarkets(); // what we can show instantly: the top 100
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const base = useId();
  const listId = `${base}-list`;
  const listRef = useRef<HTMLDivElement>(null);

  const text = normalizeSearchText(query);
  const settled = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);
  const remote = useSearch(settled);

  const topAssets = useMemo(() => (top.data ?? []).map(fromMarket), [top.data]);

  // The answer for a *previous* pause is only trusted as far as it still matches
  // what is typed now: otherwise "bit" results would linger under "bitc".
  const remoteAssets = useMemo(() => {
    const data = remote.data ?? [];
    const current = settled === text && !remote.isPlaceholderData;
    return current ? data : data.filter((a) => matchScore(a, text) !== null);
  }, [remote.data, remote.isPlaceholderData, settled, text]);

  const assets = useMemo(
    () => (text ? searchAssets(text, topAssets, remoteAssets, MAX_SEARCH_RESULTS) : []),
    [text, topAssets, remoteAssets],
  );
  const groups = useMemo(
    () => buildGroups({ query: text, theme, pages: PAGES, assets, topAssets }),
    [text, theme, assets, topAssets],
  );
  const items = flattenGroups(groups);
  const activeIndex = Math.min(active, Math.max(0, items.length - 1));
  const optionId = (item: PaletteItem) => `${base}-${itemKey(item)}`;
  const activeItem = items[activeIndex];

  const searching = text.length >= 2 && (settled !== text || remote.isFetching);
  const partial = text.length >= 2 && remote.isError && !searching;

  // Keep the highlighted row on screen as the arrows move it.
  useEffect(() => {
    if (!activeItem) return;
    listRef.current
      ?.querySelector(`[id="${optionId(activeItem)}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
    // optionId is derived from stable values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem]);

  const choose = (item: PaletteItem) => {
    if (item.kind === "action") {
      onClose();
      if (item.id === "show-shortcuts") useHotkeysStore.getState().openOverlay();
      else toggleTheme();
    } else {
      usePaletteStore.setState({ opener: null });
      onClose();
      router.push(item.href);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const last = items.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (items.length) setActive(activeIndex >= last ? 0 : activeIndex + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (items.length) setActive(activeIndex <= 0 ? last : activeIndex - 1);
        break;
      case "Home":
        if (items.length) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (items.length) {
          event.preventDefault();
          setActive(last);
        }
        break;
      case "Enter":
        if (activeItem && !event.nativeEvent.isComposing) {
          event.preventDefault();
          choose(activeItem);
        }
        break;
    }
  };

  const assetCount = items.filter((i) => i.kind === "asset").length;
  const announcement = !text
    ? ""
    : searching
      ? "Searching…"
      : items.length === 0
        ? `No results for ${text}.`
        : `${items.length} ${items.length === 1 ? "result" : "results"}, ${assetCount} ${assetCount === 1 ? "asset" : "assets"}.`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-primary px-4">
        <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <input
          role="combobox"
          aria-label="Search assets and pages"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeItem ? optionId(activeItem) : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Search assets and pages…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          // The global focus ring would draw a box inside the dialog's own border.
          className="h-full min-w-0 flex-1 bg-transparent text-body-lg text-primary outline-none placeholder:text-muted"
        />
        {searching ? (
          <LoaderCircle
            className="size-4 shrink-0 animate-spin text-muted"
            aria-hidden="true"
          />
        ) : (
          <Kbd aria-hidden="true">esc</Kbd>
        )}
      </div>

      {/* The scrolling middle. tabIndex -1: Chrome makes a scrolling box a Tab stop,
          which would trap focus here. */}
      <div
        ref={listRef}
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2"
      >
        <div id={listId} role="listbox" aria-label="Results">
          {groups.map((group) => {
            const headingId = `${base}-${group.id}`;
            return (
              <div key={group.id} role="group" aria-labelledby={headingId}>
                <div id={headingId} className="px-4 pt-3 pb-1 label-mono text-muted">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <Option
                    key={itemKey(item)}
                    id={optionId(item)}
                    item={item}
                    theme={theme}
                    selected={item === activeItem}
                    onPointer={() => setActive(items.indexOf(item))}
                    onChoose={() => choose(item)}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <p className="my-auto px-4 py-10 text-center text-body-md text-secondary">
            {searching ? "Searching…" : `No results for “${text}”.`}
          </p>
        )}
      </div>

      {partial && (
        <p className="shrink-0 border-t border-primary px-4 py-3 text-body-sm text-muted">
          Couldn&apos;t search every asset right now. Showing the top assets only.
        </p>
      )}

      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div
        aria-hidden="true"
        className="hidden shrink-0 items-center gap-5 border-t border-primary px-4 py-3 text-body-sm text-muted sm:flex"
      >
        <span className="flex items-center gap-2">
          <Kbd>
            <ArrowUp className="size-3" />
          </Kbd>
          <Kbd>
            <ArrowDown className="size-3" />
          </Kbd>
          Navigate
        </span>
        <span className="flex items-center gap-2">
          <Kbd>
            <CornerDownLeft className="size-3" />
          </Kbd>
          Open
        </span>
        <span className="flex items-center gap-2">
          <Kbd>esc</Kbd>
          Close
        </span>
      </div>
    </div>
  );
}

function Option({
  id,
  item,
  theme,
  selected,
  onPointer,
  onChoose,
}: {
  id: string;
  item: PaletteItem;
  theme: "light" | "dark";
  selected: boolean;
  onPointer: () => void;
  onChoose: () => void;
}) {
  const shortcutsOn = useHotkeysStore((s) => s.enabled);
  let leading: React.ReactNode;
  let label: string;
  let hint: React.ReactNode = null;

  if (item.kind === "asset") {
    label = item.asset.name;
    leading = <CoinLogo src={item.asset.image} name={item.asset.name} size={24} />;
    hint = (
      <>
        <span className="num text-mono-sm text-secondary">{item.asset.symbol}</span>
        <span className="w-12 text-right num text-mono-sm text-secondary">
          {item.asset.rank ? `#${item.asset.rank}` : ""}
        </span>
      </>
    );
  } else {
    const Icon =
      item.kind === "action"
        ? item.id === "show-shortcuts"
          ? Keyboard
          : theme === "dark"
            ? Sun
            : Moon
        : (PAGE_ICON[item.href] ?? House);
    label = item.label;
    leading = (
      <span className="flex size-6 items-center justify-center text-secondary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
    );
    // The shortcut for the same thing, when shortcuts are on; otherwise where it goes.
    if (item.hotkey && shortcutsOn) {
      hint = (
        <span aria-hidden="true">
          <ShortcutKeys id={item.hotkey} />
        </span>
      );
    } else if (item.kind === "page") {
      hint = <span className="num text-mono-sm text-secondary">{item.href}</span>;
    }
  }

  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      // mousedown must not take focus from the input.
      onMouseDown={(event) => event.preventDefault()}
      onMouseMove={onPointer}
      onClick={onChoose}
      className="flex h-12 cursor-pointer items-center gap-3 px-4 aria-selected:bg-overlay-hover"
    >
      {leading}
      <span className="min-w-0 flex-1 truncate text-body-md text-primary">{label}</span>
      {hint}
      <CornerDownLeft
        className={cn(
          "size-3.5 shrink-0 text-muted",
          selected ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />
    </div>
  );
}
