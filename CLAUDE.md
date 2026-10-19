# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Reference

All architectural guidelines, design tokens, spring presets, component directories, and invariant rules are defined in **[`AGENTS.md`](AGENTS.md)**. Always refer to `AGENTS.md` before implementing or modifying UI components or motion behaviors.

## Key Principles

1. **Design Tokens**: Use semantic tokens from `code-examples/cds-theme.css` (`bg-surface-0`, `clay-500`, `text-primary`, etc.). Avoid hardcoded arbitrary HEX colors.
2. **Physics**: Always use the 4 canonical spring presets from `code-examples/ClaudeMotionPresets.ts` (`SPRING_BOUNCY`, `SPRING_SNAPPY`, `SPRING_GENTLE`, `SPRING_HEAVY_SNAP`).
3. **No Binary Assets**: Use system fallback font stacks and procedural Web Audio API synthesis. Never add `.ttf`, `.otf`, `.mp3`, or `.wav` files.
4. **Input & Viewport Guards**: Use CJK IME composition guards (`!(isComposing || keyCode === 229)`) and 150ms scroll pinning cooldown latch against viewport hijacking.
5. **Security**: Keep iframe sandbox strictly isolated (no `allow-same-origin`) and gated with `navigator.userActivation`.

## Picking the right models for workflows and subagents

Rankings, higher = better. Cost reflects what I actually pay (OpenAI has really generous limits), not list price. Intelligence is how hard a problem you can hand the model unsupervised. Taste covers UI/UX, code quality, API design, and copy.

| model       | cost | intelligence | taste |
| ----------- | ---- | ------------ | ----- |
| gpt-6.1 sol | 8    | 7            | 7     |
| gpt-6 Astra | 3    | 8            | 7     |
| gpt-6 luna  | 9    | 5            | 6     |
| sonnet-5.5  | 3    | 6            | 7     |
| opus-5.5    | 7.5  | 8.5          | 9     |
| fable-5     | 2    | 9            | 9     |

How to apply:

- These are personal rankings, not provider benchmarks. A higher cost score means better affordability under the user's actual plan.
- These are defaults, not limits. You have standing permission to escalate to a more capable available model without asking when the output does not meet the task's quality bar. Judge the output, not the price tag.
- Match the model to the task's required intelligence and taste first. For work that ships, resolve quality tradeoffs in this order: intelligence > taste > cost. Use cost to choose between models that meet the required bar.
- Bulk work with a clear specification and routine implementation: gpt-6.1 sol. Data analysis and migrations belong here only when the reasoning and validation are straightforward; escalate ambiguous or high-risk work.
- Simple mechanical tasks with directly checkable results: gpt-6 luna. Its taste score is 6, so it must not own final UI/UX, copy, or API design decisions.
- Anything user-facing (UI/UX, copy, API design) needs taste >= 7. Prefer opus-5.5 for design-heavy work and complex implementation; gpt-6.1 sol can implement established patterns with clear acceptance criteria.
- Use opus-5.5 for complex work and plan/implementation reviews; use gpt-6 Astra when an OpenAI reasoning model or independent perspective is needed. Do not call fable-5 unless necessary: its affordability score is only 2, while opus-5.5 scores 7.5 with the same taste score (9) and nearly the same intelligence score (8.5 vs. 9). Escalate to fable-5 only when concrete evidence shows that the available alternatives cannot meet the task's quality bar or resolve a material uncertainty. State that evidence before invoking it; task complexity or risk alone does not justify a Fable call.
- Complex reasoning or an independent review within the OpenAI model family: gpt-6 Astra. Use gpt-6.1 sol for an additional independent perspective on routine work.
- sonnet-5.5 is a fallback for bounded Claude-only tasks or thin orchestration wrappers when the preferred model is unavailable. Its scores do not justify choosing it over gpt-6.1 sol or opus-5.5 solely to save cost.
- Never use Haiku.

Model selection and execution:

- The names in the table are preference labels. Use the exact model identifiers exposed by the current runtime; do not assume a label or a generic alias selects a particular version.
- When the runtime supports the selected model directly, use its model parameter. For OpenAI models, the identifiers are `gpt-6.1-sol`, `gpt-6-astra`, and `gpt-6-luna`, subject to availability in that runtime.
- In a Claude-only Agent/Workflow runtime, select an available sonnet-5.5 or opus-5.5 through its supported model parameter; use fable-5 only under the necessity rule above. To delegate to OpenAI, use the Codex CLI with an explicit `--model`; do not rely on the default in `~/.codex/config.toml`.
- For a read-only investigation or review through the CLI, use `rtk proxy codex exec --model <model-id> -s read-only '<self-contained prompt>'`. For authorized implementation, use the appropriate workspace-write sandbox. Include scope, constraints, expected output, and verification requirements in the prompt.
- Use the codex-implementation, codex-review, and codex-computer-use skills when they are installed and applicable; otherwise use the supported runtime or CLI directly.
- Default effort: gpt-6.1 sol uses `medium` for routine edits; gpt-6 Astra uses `xhigh` for difficult reasoning or reviews; gpt-6 luna uses `low` for mechanical work. Apply these only where the runtime supports them, and raise effort when the task requires it.
- If a Claude-only workflow needs a wrapper to call Codex, use an available sonnet-5.5 wrapper at low effort. It should prepare a self-contained prompt, invoke Codex with the explicit target model, and return the result and verification evidence. Skip the wrapper when direct model selection is supported.
- If the preferred model is unavailable, choose an available model that meets the task's quality bar and report the substitution. Never claim that an unavailable model performed the work.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## Development Commands

Use Vite+ (`vp`) for dependency management and project scripts, and `vpx` for package executables. Run package.json scripts with `vp run <script>`; use `vp check` and `vp test` for the native Vite+ checks and tests.

### Common Workflows

```bash
vp install              # Install dependencies
vp run dev                  # Start all apps in development
vp run build                # Build all apps
vp run check-types          # Type checking across all apps
vp check                # Check for lint/format issues
vp check --fix            # Auto-fix lint/format issues
vp run commit               # Commit with conventional commits (cz-git)
```

### Individual App Development

```bash
vp run dev:web              # Web app only (TanStack Start)
vp run dev:server           # Server only (Hono)
vp run dev:native           # Mobile app only (Expo)
```

### Testing

```bash
vp test                 # Run all tests
vp run test:watch           # Run tests in watch mode
vp run test:coverage        # Run tests with coverage
vp run test:server          # Server tests only
vp run test:api             # API package tests only
vp run test:db              # Database package tests only
```

### Database Management

```bash
vp run db:push              # Push schema changes to database
vp run db:generate          # Generate migration files
vp run db:migrate           # Run migrations
vp run db:studio            # Open Drizzle Studio (database UI)

# Supabase (recommended)
vp run db:start:supabase    # Start Supabase local
vp run db:stop:supabase     # Stop Supabase
vp run db:status:supabase   # Check Supabase status
vp run db:reset:supabase    # Reset Supabase database

# Docker PostgreSQL (alternative)
vp run db:start:docker
vp run db:stop:docker

# Local PostgreSQL (alternative)
vp run db:init:local
vp run db:start:local
vp run db:stop:local
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
3. Run `vp run db:push` to sync

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
rtk proxy vp list      # List dependencies through Vite+
rtk proxy vp outdated  # Check outdated packages through Vite+
rtk proxy vp install   # Install dependencies through Vite+
rtk proxy vp run <script> # Run a project script through Vite+
rtk proxy vpx <cmd>    # Run a package executable
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

| Category | Commands | Typical Savings |
| --- | --- | --- |
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | vp, vpx | Unfiltered via `rtk proxy` |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.

<!-- /rtk-instructions -->
