# FolioNote

FolioNote is a cross-platform personal learning system designed to help you **capture**, **organize**, and **revisit** what you learn—turning daily study into an evolving portfolio.

This repository is a monorepo created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), combining React (TanStack Start), React Native (Expo), Hono, oRPC, Drizzle, and more.

## What FolioNote does (MVP)

* Quick capture on mobile (text, links, photos)
* Organize on the web (tags, sources, search)
* Lightweight review workflow (queue + basic insights)
* Sync via a type-safe API

## Tech Stack

* **TypeScript** — type safety across apps and packages
* **TanStack Start** — SSR framework with TanStack Router
* **React Native + Expo** — mobile app
* **TailwindCSS + shadcn/ui** — UI styling and components
* **Hono** — lightweight backend framework
* **oRPC** — end-to-end type-safe APIs (with OpenAPI integration)
* **Bun** — runtime & package manager
* **Drizzle + PostgreSQL** — database schema and queries
* **Authentication** — Better Auth
* **Biome** — formatting and linting
* **Turborepo** — monorepo build system

## Project Structure

```bash

folio/
├── apps/
│   ├── web/         # Web app (React + TanStack Start)
│   ├── native/      # Mobile app (React Native + Expo)
│   └── server/      # Backend API (Hono + oRPC)
├── packages/
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication config & logic
│   └── db/          # Database schema & queries (Drizzle)

```

## Prerequisites

* **Bun** installed
* A running **PostgreSQL** instance
* For mobile development: **Expo Go** (or iOS Simulator / Android Emulator)

## Getting Started

Install dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Create a PostgreSQL database.
2. Update your environment variables for the server:

   * File: `apps/server/.env`
   * Required values typically include:

```bash
DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/DB_NAME"
# Auth-related variables (names may vary depending on your Better Auth setup)
AUTH_SECRET="replace-me"
AUTH_URL="http://localhost:3001"
```

3. Push the schema to your database:

```bash
bun run db:push
```

## Run in Development

Start everything:

```bash
bun run dev
```

* Web: <http://localhost:3001>
* API: <http://localhost:3000>
* Mobile: use Expo to run the native app

## Available Scripts

* `bun run dev` — start all applications in development mode
* `bun run build` — build all applications
* `bun run dev:web` — start only the web application
* `bun run dev:server` — start only the server
* `bun run dev:native` — start the React Native/Expo development server
* `bun run check-types` — check TypeScript types across all apps
* `bun run db:push` — push schema changes to database
* `bun run db:studio` — open database studio UI
* `bun run check` — run Biome formatting and linting

## Roadmap (Learning-first)

* Inbox-first capture on mobile (text/link/photo)
* Web library with tags, sources, and full-text search
* Review queue + lightweight insights
* Reliable sync (offline-safe capture + upload retry)

## License

TBD
