# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Picking the right models for workflows and subagents

Rankings, higher = better. Cost reflects what I actually pay (OpenAI has really generous limits), not list price. Intelligence is how hard a problem you can hand the model unsupervised. Taste covers UI/UX, code quality, API design, and copy.

| model         | cost | intelligence | taste |
| ------------- | ---- | ------------ | ----- |
| gpt-5.6 sol   | 3    | 9            | 8     |
| gpt-5.6 terra | 9    | 7.5          | 7     |
| gpt-5.6 luna  | 9    | 6            | 6     |
| sonnet-5      | 5    | 5            | 7     |
| opus-4.8      | 4    | 7            | 8     |
| fable-5       | 2    | 9            | 9     |

How to apply:

- These are defaults, not limits. You have standing permission to override them: if a cheaper model's output doesn't meet the bar, rerun or redo the work with a smarter model without asking. Judge the output, not the price tag. Escalating costs less than shipping mediocre work.
- Cost is a tie-breaker only; when axes conflict for anything that ships, intelligence > taste > cost.
- Bulk/mechanical work (clear-spec implementation, data analysis, migrations): gpt-5.6
- it's effectively free. - Anything user-facing (UI, copy, API design) needs taste ≥ 7.
- Reviews of plans/implementations: fable-5 or opus-4.8, optionally gpt-5.6 as an extra independent perspective.
- Never use Haiku.
- Mechanics: gpt-5.6 is only reachable through the Codex CLI - 'codex exec' / 'codex review" (my ~/. codex/config.toml defaults to gpt-5.6). Use the codex-implementation, codex-review, and codex-computer-use skills; for work they don't cover (investigation, data analysis), run codex exec -s read-only directly with a self-contained prompt.
- Claude models (sonnet-5, opus-4.8, fable-5) run via the Agent/Workflow model parameter.
- gpt-5.6 terra default effort use xhigh; gpt-5.6 sol use medium when do some edit works.

Using gpt-5.6 inside workflows and subagents (the model parameter only takes Claude models, so use a wrapper):

- Spawn a thin Claude wrapper agent with 'model: 'sonnet', effort: 'low'' whose prompt instructs it to write a self-contained codex prompt, run "codex exec' via Bash, and return

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## Development Commands

### Common Workflows

```bash
pnpm install              # Install dependencies
pnpm dev                  # Start all apps in development
pnpm build                # Build all apps
pnpm check-types          # Type checking across all apps
pnpm check                # Check for lint/format issues
pnpm check:fix            # Auto-fix lint/format issues
pnpm commit               # Commit with conventional commits (cz-git)
```

### Individual App Development

```bash
pnpm dev:web              # Web app only (TanStack Start)
pnpm dev:server           # Server only (Hono)
pnpm dev:native           # Mobile app only (Expo)
```

### Testing

```bash
pnpm test                 # Run all tests
pnpm test:watch           # Run tests in watch mode
pnpm test:coverage        # Run tests with coverage
pnpm test:server          # Server tests only
pnpm test:api             # API package tests only
pnpm test:db              # Database package tests only
```

### Database Management

```bash
pnpm db:push              # Push schema changes to database
pnpm db:generate          # Generate migration files
pnpm db:migrate           # Run migrations
pnpm db:studio            # Open Drizzle Studio (database UI)

# Supabase (recommended)
pnpm db:start:supabase    # Start Supabase local
pnpm db:stop:supabase     # Stop Supabase
pnpm db:status:supabase   # Check Supabase status
pnpm db:reset:supabase    # Reset Supabase database

# Docker PostgreSQL (alternative)
pnpm db:start:docker
pnpm db:stop:docker

# Local PostgreSQL (alternative)
pnpm db:init:local
pnpm db:start:local
pnpm db:stop:local
```

## Architecture

### Monorepo Structure

**Apps:**

- `apps/web` - React web app (TanStack Start + TanStack Router)
- `apps/native` - React Native mobile app (Expo Router)
- `apps/server` - Hono backend (oRPC + OpenAPI)

**Packages:**

- `packages/api` - oRPC router definitions and procedures
- `packages/auth` - Better Auth configuration
- `packages/db` - Drizzle ORM schema and database connection

### API Layer (oRPC)

End-to-end type-safe API between client and server.

- `packages/api/src/index.ts` - `publicProcedure` and `protectedProcedure` with auth middleware
- `packages/api/src/context.ts` - Request context with session data
- `packages/api/src/routers/` - Route definitions

Server exposes:

- `/rpc/*` - Type-safe RPC calls (RPCHandler)
- `/api-reference/*` - OpenAPI documentation
- `/api/auth/*` - Better Auth endpoints

### Authentication (Better Auth)

- Email/password + Expo plugin for mobile
- Drizzle adapter for PostgreSQL
- `requireAuth` middleware throws `UNAUTHORIZED` if no session
- `protectedProcedure` extends `publicProcedure` with auth requirement

### Database (Drizzle + PostgreSQL)

- Schema: `packages/db/src/schema/`
- Connection: `packages/db/src/index.ts`
- Config: `packages/db/drizzle.config.ts`

**Required env vars** (`apps/server/.env`):

```bash
DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/DB_NAME"
AUTH_SECRET="your-secret-key"
AUTH_URL="http://localhost:3001"
CORS_ORIGIN="http://localhost:3001"
```

## Adding New Features

### New API Endpoint

1. Define procedure in `packages/api/src/routers/`
2. Use `publicProcedure` or `protectedProcedure` as base
3. Types automatically propagate to all apps

### New Database Table

1. Define schema in `packages/db/src/schema/`
2. Export from `packages/db/src/index.ts`
3. Run `pnpm db:push` to sync

## Engineering Philosophy

### Decision Priority

1. Correctness & invariants
2. Simplicity (KISS > DRY)
3. Testability / verifiability
4. Maintainability (low coupling, high cohesion)
5. Performance (measure first)

### Change Rules

- Minimal diff; no unrelated churn
- Names use domain language; comments explain WHY
- One abstraction level per function
- Patterns/abstractions only with clear change scenario
- Handle failures explicitly (no silent errors)

### Anti-Patterns

- Premature optimization
- Abstraction before 3rd use
- Swallowing errors / silent failures
- Hidden coupling across modules

## Framework Notes

**TanStack Start:** Use `'use server'` for server functions, `'use client'` for client components

**Expo:** File-based routing with Expo Router, `heroui-native` for UI

**React 19:** Use ref as a prop instead of `React.forwardRef`

## MCP Integration

Use Context7 MCP for library/API documentation lookup.

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

<!-- rtk-instructions v2 -->

# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:

```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)

```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)

```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vp test             # Project tests through Vite+
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)

```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)

```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)

```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)

```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)

```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)

```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)

```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands

```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category         | Commands                       | Typical Savings |
| ---------------- | ------------------------------ | --------------- |
| Tests            | vitest, playwright, cargo test | 90-99%          |
| Build            | next, tsc, lint, prettier      | 70-87%          |
| Git              | status, log, diff, add, commit | 59-80%          |
| GitHub           | gh pr, gh run, gh issue        | 26-87%          |
| Package Managers | pnpm, npm, npx                 | 70-90%          |
| Files            | ls, read, grep, find           | 60-75%          |
| Infrastructure   | docker, kubectl                | 85%             |
| Network          | curl, wget                     | 65-70%          |

Overall average: **60-90% token reduction** on common development operations.

<!-- /rtk-instructions -->
