# Pelago

A crypto market dashboard built as a frontend portfolio project: live prices, charts, a market
heatmap and comparisons for the top assets, with the emphasis on UI quality, motion, data
visualization, performance and accessibility. No custom backend: only public APIs behind Next.js
route handlers.

**Live:** https://pelago-project.vercel.app

## Features

- **Live prices.** One WebSocket to Binance for the whole app. A price flashes green or red when it
  changes; the page header, the chart's last candle and the ticker strip follow the feed. If the
  socket is blocked (some networks and regions block Binance) the app says so and falls back to
  polling once a minute.
- **Markets.** The top 100 by market cap: search, sort, category filters, gainers and losers,
  sparklines. Everything that can be shared (search, sort, filter, page) is in the URL.
- **Heatmap** (`/heatmap`). A treemap of the market: area is market cap or volume, colour is the
  price change over 1 hour, 24 hours or 7 days. Top 50, 100 or 200 assets, optional category.
  Keyboard and touch friendly, with a preview on the home page.
- **Asset pages.** Line and candlestick charts (24H, 7D, 30D, 1Y), a price or percent axis, zoom, and
  scrolling back through history that loads on demand.
- **Compare.** Two to four assets from the same starting point, on a chart and in a table.
- **Watchlist.** Starred assets, kept in the browser and synced between tabs.
- **Command palette** (`Ctrl/Cmd + K`): jump to a page or any asset, switch the theme.
- **Keyboard shortcuts** (below), light and dark themes, motion that respects `prefers-reduced-motion`.

## Keyboard shortcuts

Press `?` anywhere to see them. Single-key shortcuts can be switched off there (WCAG 2.1.4);
`Ctrl/Cmd + K` always works. They never fire while you type in a field or when a dialog is open.

| Keys                         | What it does                                         |
| ---------------------------- | ---------------------------------------------------- |
| `Ctrl/Cmd` + `K`             | Search assets and pages                              |
| `?`                          | Show the shortcuts                                   |
| `/`                          | Focus the page's search field (or the palette)       |
| `t`                          | Switch light and dark theme                          |
| `g` then `h`/`m`/`p`/`w`/`c` | Go to Home / Markets / Heatmap / Watchlist / Compare |
| `j` / `k`                    | Next / previous row (Markets, Watchlist)             |
| `Enter`, `w`                 | Open the selected row, star it                       |
| `1` `2` `3` `4`              | Asset chart: 24H, 7D, 30D, 1Y                        |
| `c`, `a`                     | Asset chart: line or candles; compare                |

Inside the heatmap the picture is one tab stop: arrow keys move to the nearest cell in that
direction, `Home`/`End` jump to the first and last, `Enter` opens the asset. On the Russian and
Ukrainian layouts the letter shortcuts work too (they are matched by key, falling back to the
physical key).

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · Motion · TanStack Query · Zustand ·
Zod · Radix UI primitives · Lightweight Charts · d3-hierarchy (layout only) · Vitest + Testing
Library · CoinGecko API (data) · Binance WebSocket (live prices). Fonts: Inter (headings), Krub (text),
Roboto Mono (figures).

## Getting started

```bash
npm install
cp .env.example .env.local   # add a free CoinGecko Demo key (see below)
npm run dev
```

Open http://localhost:3000. A free [Demo key](https://www.coingecko.com/en/api/pricing) goes in
`COINGECKO_API_KEY`. It is server-only: the browser never sees it. The app starts without one, but
CoinGecko's anonymous limits are strict and shared, so you will see rate-limit errors quickly.

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start the dev server                           |
| `npm run build`     | Production build                               |
| `npm run typecheck` | Generate Next route types, then `tsc --noEmit` |
| `npm run lint`      | ESLint                                         |
| `npm run format`    | Prettier (with Tailwind class sorting)         |
| `npm test`          | Vitest, run once                               |

The design system lives at `/styleguide`: every token, primitive and state in both themes.

### Deploying to Vercel

Import the repository on Vercel (the Next.js preset needs no configuration) and set
`COINGECKO_API_KEY` for Production and Preview **before the first deploy**, so the pages that
fetch data at build time get real data. Note that `next build` type-checks test files too: a type
error in one fails the deploy. After deploying, open `/api/heatmap` (it should return JSON, not a 429) and check that the home page's HTML has no ticker strip:
`curl -s URL | grep -c 'Live prices of the top assets'` is `0` for `/` and `1` for other pages.

## How data flows

```
Browser ──> /api/* route handlers ──> CoinGecko
   │            │  zod-validate + reshape
   │            │  Next data cache (revalidate windows)
   │            └─ Cache-Control s-maxage for the CDN
   └──────────> wss://data-stream.binance.vision   (prices only, no key)
```

- The client only ever calls our own `/api` routes for market data, never CoinGecko.
- Responses are validated with Zod on the server and reduced to lean, null-safe types before
  anything else sees them. Zod never reaches the browser (a test fails if it would).
- On a rate limit or outage the server falls back to the last good response (flagged stale).
- Failures are typed (`ApiError`: `rate_limited`, `not_found`, ...) and shown as real error states
  with a retry.

## Technical decisions

**Live prices (`src/lib/live`).** One socket, opened only while something on screen shows a price
and kept for a few seconds after, so a page change doesn't close and reopen it. It reads the
all-symbols mini-ticker stream (about one message a second), keeps the latest price per symbol in a
buffer and hands it to the store in one batch per second on an animation frame. Components
subscribe to one symbol each (`useSyncExternalStore`), so only the cell that moved re-renders: a
feed of 1,500 symbols a second with 200 flashing heatmap cells holds 60 fps. Reconnects use a
doubling, jittered backoff and alternate between two Binance hosts; a socket that goes silent for
10 seconds is declared dead; after three attempts that never delivered a price the status becomes
"polling". The socket is closed while the tab is hidden. CoinGecko and Binance only share tickers,
and tickers are not unique, so a streamed price is accepted only for the top 300 assets and only
if it is within 10% of the polled price. The 24h change is measured from the day-ago price implied
by CoinGecko's own numbers, so a row never contradicts itself. The price flash is the opacity of a
layer over the number, not an animated background: repainting a hundred backgrounds a second
dropped scrolling to 30 fps.

**Motion and View Transitions.** Every duration is a token (120 / 200 / 300 / 500 ms and a spring
curve), mirrored in `lib/motion.ts`, and a test fails on a raw duration anywhere in the source.
Route changes use React's `<ViewTransition>` (a quick crossfade, a slide when the link says it goes
forward or back, and a shared-element morph for the coin you clicked). Changing the theme crossfades
the whole page, tuned by two CSS variables (`--theme-duration`, `--theme-ease`). Reduced motion keeps
the fades and drops everything that moves.

**Heatmap (`src/lib/heatmap.ts`, `src/components/heatmap`).** d3-hierarchy only does the layout; the
cells are SVG links. One request carries the top 200 of a category; the period, size and count are
slices of it, so changing them costs no request. Cells stay in rank order in the DOM whatever the
area means, because React moves reordered elements and a moved element doesn't animate. Colours are
`color-mix` of the success and critical tokens into the page colour, three steps each way, with
thresholds per period; a test recomputes the mix from the stylesheet and fails if a label drops
below 4.5:1 in either theme. Labels are fitted without measuring (the font is monospace).

**Keyboard system (`src/lib/hotkeys`).** One catalog lists every shortcut; the dispatcher, the
overlay, the palette and the tooltips all read it, so what is shown can never differ from what
works. The dispatcher is plain TypeScript (sequences with a timeout, ignores typing targets, open
dialogs, modifier chords and IME composition) and is tested without React.

**Design tokens.** Every colour, size, radius and duration is a CSS variable in one file. Tailwind's
default palette is switched off, so only the tokens exist. Hex values appear only in the token file
and the favicon.

**Hydration safety.** Anything that differs between the server and the browser is made consistent on
purpose: formatting pins the locale and time zone; the chart legend writes UTC on the server and
the visitor's own time right after hydration; whether the page is the home page is read from the
route tree, never from the URL (a prerendered page can be rendered under another path).

**Performance.** Pages that fetch data render real numbers into the first HTML, and the data is
considered fresh for two minutes so a page doesn't ask for it again the moment it loads. Code that
is only used on request (the command palette, the shortcuts overlay, the home heatmap's treemap) is
loaded after the page. Sparklines are rounded to six significant digits (a third of the home page's
HTML was digits nobody can see). Mobile Lighthouse (simulated slow 4G, 4x CPU): home 88, Markets 91,
Heatmap 91, Compare 90, Asset 89; accessibility, best practices and SEO are 100 on every public
page. The remaining cost is shared JavaScript (the React runtime and the motion library).

## Testing

`npm test` runs ~1,350 tests. They cover the pure logic (formatting, the live connection against a
fake socket and fake timers, the hotkey dispatcher, the treemap layout, URL state), the components
(keyboard use, touch, live updates, cleanup of observers and listeners) and guards that read the
source: no raw durations, no hex colours outside the tokens, the heatmap's label contrast, the
client bundle's import graph. Behaviour was also checked in real browsers: production builds on
phone and desktop viewports, both themes, a contrast audit of every rendered label, keyboard-only
walks through every page, and memory checks over repeated navigation.

Not checked: Safari and Firefox (the animations of the heatmap cells use CSS transitions on SVG
geometry, which would degrade to no animation), and real screen readers (only ARIA and focus order).

## Project structure

```
src/
  app/          routes, route handlers (api/), global styles and design tokens
  components/   ui/ (primitives), layout/, live/, heatmap/, coin/, compare/, markets/, home/,
                shortcuts/, command/, motion/
  lib/          api/ (fetcher, schemas, errors, query client), live/ (socket, store), hotkeys/,
                heatmap, chart-data, format, theme
  hooks/        use-live, use-hotkey, URL-state hooks
  stores/       Zustand: watchlist, compare, palette, hotkeys
  providers/    Query, Motion, Live, Hotkeys
  test/         Vitest setup, fixtures, router mock
```
