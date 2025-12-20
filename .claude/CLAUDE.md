# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FolioNote is a cross-platform personal learning system for capturing, organizing, and revisiting what you learn. Built as a monorepo with Better-T-Stack, it combines React (TanStack Start), React Native (Expo), Hono, oRPC, Drizzle, and PostgreSQL.

## Development Commands

### Common Workflows

```bash
# Install dependencies
bun install

# Start all apps in development
bun run dev

# Build all apps
bun run build

# Type checking across all apps
bun run check-types

# Format and lint code
bun run check           # Check for issues
bun x ultracite fix     # Auto-fix issues
```

### Individual App Development

```bash
# Web app only (TanStack Start)
bun run dev:web

# Server only (Hono)
bun run dev:server

# Mobile app only (Expo)
bun run dev:native
```

### Database Management

```bash
# Push schema changes to database
bun run db:push

# Generate migration files
bun run db:generate

# Run migrations
bun run db:migrate

# Open Drizzle Studio (database UI)
bun run db:studio

# Docker PostgreSQL management
bun run db:start:docker
bun run db:stop:docker

# Local PostgreSQL management
bun run db:init:local
bun run db:start:local
bun run db:stop:local
```

## Architecture Overview

### Monorepo Structure

This is a **Turborepo** monorepo with three apps and three shared packages:

**Apps:**

- `apps/web` - React web app using TanStack Start (SSR framework with TanStack Router)
- `apps/native` - React Native mobile app using Expo Router
- `apps/server` - Hono backend server exposing oRPC and OpenAPI endpoints

**Packages:**

- `packages/api` - Shared API layer containing oRPC router definitions and procedures
- `packages/auth` - Better Auth configuration shared across apps
- `packages/db` - Drizzle ORM schema and database connection

### API Architecture (oRPC)

The API is built with **oRPC**, which provides end-to-end type safety between client and server.

**Key files:**

- `packages/api/src/index.ts` - Defines `publicProcedure` and `protectedProcedure` with authentication middleware
- `packages/api/src/context.ts` - Creates request context with session data from Better Auth
- `packages/api/src/routers/index.ts` - Exports `appRouter` with all API endpoints

**Server integration** (`apps/server/src/index.ts`):

- Uses `RPCHandler` for type-safe RPC calls at `/rpc/*`
- Uses `OpenAPIHandler` for OpenAPI documentation at `/api-reference/*`
- Hono middleware handles CORS, logging, and Better Auth at `/api/auth/*`

**Client usage:**

- Web and native apps use `@orpc/tanstack-query` for React Query integration
- Import `AppRouter` type from `packages/api` for full type safety

### Authentication Flow

**Better Auth** is configured in `packages/auth/src/index.ts`:

- Email/password authentication enabled
- Expo plugin for mobile auth
- Drizzle adapter for PostgreSQL persistence
- Session management via cookies (SameSite=none for cross-origin)

**Schema** (`packages/db/src/schema/auth.ts`):

- User, session, account, and verification tables
- Drizzle relations defined for type-safe joins

**Middleware** (`packages/api/src/index.ts`):

- `requireAuth` middleware throws `UNAUTHORIZED` if no session
- `protectedProcedure` extends `publicProcedure` with auth requirement

### Database Layer

**Drizzle ORM** with PostgreSQL:

- Connection: `packages/db/src/index.ts` creates drizzle client from `DATABASE_URL`
- Schema: `packages/db/src/schema/auth.ts` (currently only auth tables)
- Config: `packages/db/drizzle.config.ts` for Drizzle Kit

**Environment variables required** (in `apps/server/.env`):

```bash
DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/DB_NAME"
AUTH_SECRET="your-secret-key"
AUTH_URL="http://localhost:3001"
CORS_ORIGIN="http://localhost:3001"
```

### Mobile App Structure

**Expo Router** with nested navigation:

- `apps/native/app/_layout.tsx` - Root layout
- `apps/native/app/(drawer)/` - Drawer navigation
- `apps/native/app/(drawer)/(tabs)/` - Tab navigation within drawer
- Uses `heroui-native` for UI components
- React 19 with React Native 0.81

### Web App Structure

**TanStack Start** (SSR framework):

- Built with Vite
- Uses TanStack Router for routing
- TailwindCSS 4.x with Base UI components
- React 19
- Dark mode support via `next-themes`

## Important Development Notes

### Type Safety

- All API calls between client and server are fully type-safe via oRPC
- Import `AppRouterClient` type for client-side type inference
- Context typing is derived from `createContext` return type

### Adding New API Endpoints

1. Define procedure in `packages/api/src/routers/index.ts`
2. Use `publicProcedure` or `protectedProcedure` as base
3. Types automatically propagate to all consuming apps
4. No manual OpenAPI spec writing needed - auto-generated

### Adding New Database Tables

1. Define schema in `packages/db/src/schema/`
2. Export from `packages/db/src/index.ts`
3. Add to drizzle client schema object
4. Run `bun run db:push` to sync to database

### Code Quality

This project uses **Ultracite** (Biome preset) for formatting and linting. Run `bun x ultracite fix` before committing. See the code standards section below for details.

---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config Biome preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Biome (the underlying engine) provides extremely fast Rust-based linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**TanStack Start (this project's web framework):**

- Use TanStack Router for navigation
- Server functions run on the server - mark with `'use server'`
- Client components need `'use client'` directive

**React Native + Expo (this project's mobile framework):**

- Use Expo Router for navigation (file-based routing)
- Use `heroui-native` components for UI
- Test on both iOS and Android simulators

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `bun x ultracite fix` before committing to ensure compliance.
