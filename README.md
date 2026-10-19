# FolioNote

FolioNote is a personal learning workspace for capturing notes, organizing knowledge, and revisiting what you learn. It combines a web app, an Expo mobile app, and a shared API, with AI-assisted knowledge exploration and dedicated Japanese study tools.

Originally scaffolded with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack).

## Features

- **Notes and organization** — inbox capture, rich-text editing, tags, sources, search, and a knowledge graph.
- **Review and activity** — review queues and study activity tracking.
- **AI knowledge workspace** — chat sessions, retrieval over saved content, and configurable model providers.
- **Japanese study** — vocabulary, kanji, grammar, reading analysis, personal word lists, article imports, vocabulary practice, and exams.
- **Sharing and collaboration** — shared notes and collaborative editing through a separate collaboration server.
- **Web and mobile** — a browser workspace and an Expo app with note capture, review, and Japanese reading flows. Feature coverage differs between clients.
- **Localization** — Simplified Chinese, English, and Japanese interfaces.

AI, uploads, and external connections require their respective configuration. Japanese study content must be imported separately; creating the database schema does not populate it.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Web | React 19, TanStack Start, TanStack Router, TanStack Query |
| Mobile | React Native, Expo, Expo Router, SQLite |
| UI | Tailwind CSS, HeroUI, HeroUI Pro, shared UI components; Uniwind on mobile |
| Editor | Tiptap, Yjs, Hocuspocus |
| API | Hono, oRPC, Zod |
| Authentication | Better Auth |
| Database | PostgreSQL, Drizzle ORM |
| AI | AI SDK, Mastra, shared AI tools and model catalog |
| Tooling | TypeScript, Vite+, Turborepo, Ultracite rules with oxlint and oxfmt |
| Tests | Vite+ test runner, Testing Library |

## Repository Structure

```text
apps/
├── web/              # TanStack Start web app
├── native/           # Expo mobile app
└── server/           # Hono API and collaboration server
packages/
├── api/              # oRPC routers and business logic
├── auth/             # Better Auth configuration
├── db/               # PostgreSQL schema, migrations, and import scripts
├── ai/               # AI providers, prompts, and retrieval utilities
├── ai-tools/         # Shared AI tools
├── model-list/       # Model catalog
├── japanese/         # Japanese analysis and import utilities
├── editor-core/      # Shared editor logic
├── editor-react/     # React editor components
├── ui/               # Shared web components and design tokens
├── locales/          # zh-CN, en-US, and ja-JP translations
├── storage/          # S3-compatible file storage
├── transactional/    # Email templates
├── config/           # Shared tooling configuration
├── constants/        # Shared constants
├── log/              # Logging utilities
└── utils/            # Shared utilities
docs/                # Feature and operations documentation
design/brand/        # Icon sources and platform previews
```

## Local Development

### Prerequisites

- **Node.js** matching [`.node-version`](./.node-version) (currently `24.22.0`).
- **Vite+** (`vp`) for dependency installation, scripts, checks, and tests. The workspace retains a pnpm lockfile; use `vp` as the command entry point.
- **PostgreSQL**. The Docker setup below uses PostgreSQL 17 and requires Docker with Compose.
- **HeroUI Pro access**. The project includes licensed Pro packages; installation requires valid authorization. CI supplies `HEROUI_AUTH_TOKEN` through its secret store. Keep credentials out of committed files.
- For mobile development, an iOS Simulator, Android emulator, or physical device with a compatible native build.

Run the following commands from the repository root unless a step says otherwise.

### 1. Install dependencies

```bash
vp install
```

### 2. Configure the environment

Copy the templates for a fresh checkout. If these files already exist, update them instead of overwriting local settings.

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

Set these values in `apps/server/.env` for the Docker database below:

```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/folio_note
BETTER_AUTH_SECRET=<replace-with-a-generated-secret>
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
```

Generate a secret locally with `openssl rand -hex 32` and use the output as `BETTER_AUTH_SECRET`.

Set the web URLs in `apps/web/.env`:

```dotenv
VITE_SERVER_URL=http://localhost:3000
VITE_WEB_URL=http://localhost:3001
```

`BETTER_AUTH_URL` points to the API server; `VITE_WEB_URL` points to the web app. Keep private keys in server-side configuration, outside `VITE_*` and `EXPO_PUBLIC_*` variables.

### 3. Start PostgreSQL and create the schema

```bash
docker compose -f packages/db/docker-compose.yml up -d
DATABASE_URL="postgresql://postgres:password@localhost:5432/folio_note" vp run db:push
```

Use `db:push` for a fresh local database. The explicit `DATABASE_URL` prevents Drizzle from falling back to its local Supabase connection. If you use another PostgreSQL instance, replace the URL in both the environment file and the command.

For migration workflows and other database setups, see [database package documentation](./packages/db/README.md) and [migration guidance](./packages/db/MIGRATIONS.md).

### 4. Start the API and web app

Run these in separate terminals:

```bash
# Terminal 1: API
DATABASE_URL="postgresql://postgres:password@localhost:5432/folio_note" vp run dev:server
```

```bash
# Terminal 2: web app
vp run dev:web
```

Open [the web app](http://localhost:3001). The API listens on [localhost:3000](http://localhost:3000). Email/password authentication is enabled; GitHub and Google sign-in require provider credentials.

`vp run dev` starts the workspace development tasks, including the native app. Use the individual commands above when working only on the web and API.

### Optional services and mobile development

| Capability | Configuration |
| --- | --- |
| AI chat | Configure provider credentials and model selection on `/settings/models`. |
| File uploads | Configure `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and `S3_REGION` in the server environment. |
| GitHub / Google sign-in | Set the matching client ID and client secret from the server environment template. |
| Email delivery | Set `RESEND_API_KEY`; without it, verification and password-reset links are logged by the server for local development. |
| Collaborative editing | Run `vp run dev:collab` from `apps/server` in another terminal; the default WebSocket port is `3002`. |

For mobile development, copy `apps/native/.env.example` to `apps/native/.env` and set `EXPO_PUBLIC_SERVER_URL` to an API address reachable from the simulator or device. On a physical device, use your computer’s LAN address rather than `localhost`, and configure the corresponding auth URL and allowed origins as needed.

```bash
vp run dev:native
```

To build and run the native app, use `vp run ios` or `vp run android` from `apps/native` with the corresponding platform toolchain installed.

## Common Commands

| Command              | Purpose                           |
| -------------------- | --------------------------------- |
| `vp run dev:web`     | Start the web app                 |
| `vp run dev:server`  | Start the API                     |
| `vp run dev:native`  | Start Expo development            |
| `vp run build`       | Run workspace build tasks         |
| `vp run check-types` | Check workspace TypeScript types  |
| `vp check`           | Check formatting and lint rules   |
| `vp check --fix`     | Apply formatting and lint fixes   |
| `vp test`            | Run the configured test suite     |
| `vp run test:server` | Run the server test project       |
| `vp run test:api`    | Run API package tests             |
| `vp run test:db`     | Run database package tests        |
| `vp run check-keys`  | Check translation key consistency |
| `vp run db:studio`   | Open Drizzle Studio               |
| `vp run db:generate` | Generate a database migration     |
| `vp run db:migrate`  | Apply database migrations         |

Database commands must target the intended database through `DATABASE_URL`.

## Documentation

- [Contributing](./CONTRIBUTING.md)
- [Notes and entries](./docs/entries-feature.md)
- [Editor features](./docs/editor-features.md)
- [Advanced search](./docs/advanced-search.md)
- [AI knowledge chat](./docs/knowledge-chat-session-frontend.md)
- [Japanese learning roadmap](./docs/japanese-media-learning-roadmap.md)
- [Database design](./docs/database-guide.md)
- [Storage setup](./docs/supabase-storage.md)
- [Internationalization](./docs/i18n-guide.md)
- [Server deployment](./docs/server-deployment.md)
- [Versioning](./docs/versioning.md)
- [Brand assets](./design/brand)

## License

[MIT](./LICENSE). Third-party dependencies, including HeroUI Pro packages, retain their own licenses.
