# WMS APA Nano Frontend

Next.js App Router frontend for WMS APA Nano. This app is the browser UI only; all persistent data goes through HTTP to the backend.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, Axios, next-intl, pnpm 11.22.0. Node.js 22+.

## Install

```bash
pnpm install
```

## Development

```bash
pnpm env:init
pnpm dev
```

Open http://localhost:3000.

## Build

```bash
pnpm build
pnpm start
```

## Lint / typecheck / tests

```bash
pnpm lint
pnpm typecheck
pnpm knip
pnpm exec playwright install chromium
pnpm test
```

`pnpm test` starts the production server from an existing build, so run `pnpm build` first.

## Environment

Copy `.env.example` to `.env` (or run `pnpm env:init`). Application config is read from `src/config/env.ts`.

| Variable | Role |
| --- | --- |
| `NEXT_PUBLIC_APP_NAME` | UI / metadata name |
| `NEXT_PUBLIC_API_URL` | REST backend base URL |
| `NEXT_PUBLIC_DEMO_MODE` | In-memory demo adapter when `true` |
| `NEXT_PUBLIC_API_CREDENTIALS` | Axios `withCredentials` |

`NEXT_PUBLIC_*` values are inlined at build time.

## Folder architecture

| Path | Responsibility |
| --- | --- |
| `src/app` | Routes, layouts, metadata |
| `src/features` | Feature UI, API clients, hooks, schemas |
| `src/components` | Shared and shadcn primitives |
| `src/lib` | HTTP client, auth token/session helpers |
| `src/i18n` + `messages/` | next-intl |
| `public/` | Static assets (`/images/...`, `/icons/...`) |
| `tests/` | Playwright E2E and HTTP integration |
