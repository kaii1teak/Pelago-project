# Pelago

A polished crypto market dashboard built as a frontend portfolio project: live prices, charts and
comparisons for the top assets, with the emphasis on UI quality, motion, data visualization,
performance and accessibility. No custom backend, only public APIs behind Next.js route handlers.

> **Status:** Milestones 0-2 of 7 (design system, Home, Markets), restyled to a flat, monochrome
> "engineering document" look. Asset, Watchlist, Compare and the command palette are next. The full README (screenshots,
> technical decisions) lands in the final milestone.

<!-- Screenshots: add after the polish milestone -->

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 · Motion (Framer Motion) ·
TanStack Query · Zustand · Zod · Radix UI primitives · Roboto + Roboto Mono · Vitest + Testing Library · CoinGecko API

## Getting started

```bash
npm install
cp .env.example .env.local   # optional: add a free CoinGecko Demo key
npm run dev
```

Open http://localhost:3000. The app works without an API key, with CoinGecko's stricter anonymous
rate limits. A free [Demo key](https://www.coingecko.com/en/api/pricing) goes in `COINGECKO_API_KEY`
(server-only; the browser never sees it).

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start the dev server                           |
| `npm run build`     | Production build                               |
| `npm run typecheck` | Generate Next route types, then `tsc --noEmit` |
| `npm run lint`      | ESLint                                         |
| `npm run format`    | Prettier (with Tailwind class sorting)         |
| `npm test`          | Vitest, run once                               |

The design system lives at `/styleguide`: every token, primitive and state in both themes.

## How data flows

```
Browser ──> /api/* route handlers ──> CoinGecko
              │  zod-validate + reshape
              │  Next data cache (revalidate windows)
              └─ Cache-Control s-maxage for the CDN
```

- The client only ever calls our own `/api` routes, never CoinGecko.
- Responses are validated with Zod and reduced to lean, null-safe types before anything else sees them.
- On a rate limit or outage, the server falls back to the last good response (flagged stale) when it has one.
- Failures are typed (`ApiError`: `rate_limited`, `not_found`, ...) and rendered as real error states with retry.

## Project structure

```
src/
  app/          routes, route handlers (api/), global styles and design tokens
  components/   ui/ (primitives), layout/, motion/ (Reveal, CountUp)
  lib/          api/ (fetcher, schemas, errors, query client), format, theme
  hooks/        use-theme
  providers/    Query + Motion providers
  test/         Vitest setup and API fixtures
```
# Pelago-project
