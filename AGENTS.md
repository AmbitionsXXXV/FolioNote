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

# Ultracite Code Standards

This project uses **Ultracite** lint/format rules, run through **Vite+** (`vp`) on the oxlint + oxfmt engines (configured in the root `vite.config.ts`).

## Quick Reference

- **Format code**: `vp fmt . --write`
- **Check for issues**: `vp check`
- **Auto-fix issues**: `vp check --fix`

oxlint and oxfmt (the underlying Rust engines, run via Vite+) provide extremely fast linting and formatting. Most issues are automatically fixable.

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

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When the linter can't help

oxlint will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - the linter can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by oxfmt/oxlint. Run `vp check --fix` before committing to ensure compliance.

# Web Interface Guidelines

Concise rules for building accessible, fast, delightful UIs Use MUST/SHOULD/NEVER to guide decisions

## Interactions

- Keyboard
  - MUST: Full keyboard support per [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)
  - MUST: Visible focus rings (`:focus-visible`; group with `:focus-within`)
  - MUST: Manage focus (trap, move, and return) per APG patterns
- Targets & input
  - MUST: Hit target ≥24px (mobile ≥44px) If visual <24px, expand hit area
  - MUST: Mobile `<input>` font-size ≥16px or set:

    ```html
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
    />
    ```

  - NEVER: Disable browser zoom
  - MUST: `touch-action: manipulation` to prevent double-tap zoom; set `-webkit-tap-highlight-color` to match design

- Inputs & forms (behavior)
  - MUST: Hydration-safe inputs (no lost focus/value)
  - NEVER: Block paste in `<input>/<textarea>`
  - MUST: Loading buttons show spinner and keep original label
  - MUST: Enter submits focused text input In `<textarea>`, ⌘/Ctrl+Enter submits; Enter adds newline
  - MUST: Keep submit enabled until request starts; then disable, show spinner, use idempotency key
  - MUST: Don’t block typing; accept free text and validate after
  - MUST: Allow submitting incomplete forms to surface validation
  - MUST: Errors inline next to fields; on submit, focus first error
  - MUST: `autocomplete` + meaningful `name`; correct `type` and `inputmode`
  - SHOULD: Disable spellcheck for emails/codes/usernames
  - SHOULD: Placeholders end with ellipsis and show example pattern (eg, `+1 (123) 456-7890`, `sk-012345…`)
  - MUST: Warn on unsaved changes before navigation
  - MUST: Compatible with password managers & 2FA; allow pasting one-time codes
  - MUST: Trim values to handle text expansion trailing spaces
  - MUST: No dead zones on checkboxes/radios; label+control share one generous hit target
- State & navigation
  - MUST: URL reflects state (deep-link filters/tabs/pagination/expanded panels) Prefer libs like [nuqs](https://nuqs.dev)
  - MUST: Back/Forward restores scroll
  - MUST: Links are links—use `<a>/<Link>` for navigation (support Cmd/Ctrl/middle-click)
- Feedback
  - SHOULD: Optimistic UI; reconcile on response; on failure show error and rollback or offer Undo
  - MUST: Confirm destructive actions or provide Undo window
  - MUST: Use polite `aria-live` for toasts/inline validation
  - SHOULD: Ellipsis (`…`) for options that open follow-ups (eg, "Rename…") and loading states (eg, "Loading…", "Saving…", "Generating…")
- Touch/drag/scroll
  - MUST: Design forgiving interactions (generous targets, clear affordances; avoid finickiness)
  - MUST: Delay first tooltip in a group; subsequent peers no delay
  - MUST: Intentional `overscroll-behavior: contain` in modals/drawers
  - MUST: During drag, disable text selection and set `inert` on dragged element/containers
  - MUST: No “dead-looking” interactive zones—if it looks clickable, it is
- Autofocus
  - SHOULD: Autofocus on desktop when there’s a single primary input; rarely on mobile (to avoid layout shift)

## Animation

- MUST: Honor `prefers-reduced-motion` (provide reduced variant)
- SHOULD: Prefer CSS > Web Animations API > JS libraries
- MUST: Animate compositor-friendly props (`transform`, `opacity`); avoid layout/repaint props (`top/left/width/height`)
- SHOULD: Animate only to clarify cause/effect or add deliberate delight
- SHOULD: Choose easing to match the change (size/distance/trigger)
- MUST: Animations are interruptible and input-driven (avoid autoplay)
- MUST: Correct `transform-origin` (motion starts where it “physically” should)

## Layout

- SHOULD: Optical alignment; adjust by ±1px when perception beats geometry
- MUST: Deliberate alignment to grid/baseline/edges/optical centers—no accidental placement
- SHOULD: Balance icon/text lockups (stroke/weight/size/spacing/color)
- MUST: Verify mobile, laptop, ultra-wide (simulate ultra-wide at 50% zoom)
- MUST: Respect safe areas (use env(safe-area-inset-\*))
- MUST: Avoid unwanted scrollbars; fix overflows

## Content & Accessibility

- SHOULD: Inline help first; tooltips last resort
- MUST: Skeletons mirror final content to avoid layout shift
- MUST: `<title>` matches current context
- MUST: No dead ends; always offer next step/recovery
- MUST: Design empty/sparse/dense/error states
- SHOULD: Curly quotes (“ ”); avoid widows/orphans
- MUST: Tabular numbers for comparisons (`font-variant-numeric: tabular-nums` or a mono like Geist Mono)
- MUST: Redundant status cues (not color-only); icons have text labels
- MUST: Don’t ship the schema—visuals may omit labels but accessible names still exist
- MUST: Use the ellipsis character `…` (not ``)
- MUST: `scroll-margin-top` on headings for anchored links; include a “Skip to content” link; hierarchical `<h1–h6>`
- MUST: Resilient to user-generated content (short/avg/very long)
- MUST: Locale-aware dates/times/numbers/currency
- MUST: Accurate names (`aria-label`), decorative elements `aria-hidden`, verify in the Accessibility Tree
- MUST: Icon-only buttons have descriptive `aria-label`
- MUST: Prefer native semantics (`button`, `a`, `label`, `table`) before ARIA
- SHOULD: Right-clicking the nav logo surfaces brand assets
- MUST: Use non-breaking spaces to glue terms: `10&nbsp;MB`, `⌘&nbsp;+&nbsp;K`, `Vercel&nbsp;SDK`

## Performance

- SHOULD: Test iOS Low Power Mode and macOS Safari
- MUST: Measure reliably (disable extensions that skew runtime)
- MUST: Track and minimize re-renders (React DevTools/React Scan)
- MUST: Profile with CPU/network throttling
- MUST: Batch layout reads/writes; avoid unnecessary reflows/repaints
- MUST: Mutations (`POST/PATCH/DELETE`) target <500 ms
- SHOULD: Prefer uncontrolled inputs; make controlled loops cheap (keystroke cost)
- MUST: Virtualize large lists (eg, `virtua`)
- MUST: Preload only above-the-fold images; lazy-load the rest
- MUST: Prevent CLS from images (explicit dimensions or reserved space)

## Design

- SHOULD: Layered shadows (ambient + direct)
- SHOULD: Crisp edges via semi-transparent borders + shadows
- SHOULD: Nested radii: child ≤ parent; concentric
- SHOULD: Hue consistency: tint borders/shadows/text toward bg hue
- MUST: Accessible charts (color-blind-friendly palettes)
- MUST: Meet contrast—prefer [APCA](https://apcacontrast.com/) over WCAG 2
- MUST: Increase contrast on `:hover/:active/:focus`
- SHOULD: Match browser UI to bg
- SHOULD: Avoid gradient banding (use masks when needed)

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Port | Notes |
| --- | --- | --- | --- |
| PostgreSQL | `sudo docker compose up -d` (in `packages/db/`) | 5432 | Uses `docker-compose.yml` with postgres:17-alpine |
| API server | `vp run dev:server` | 3000 | Hono backend; needs `DATABASE_URL` env var |
| Web app | `vp run dev:web` | 3001 | TanStack Start + Vite |

### Database setup

This project supports three PostgreSQL options (see `CLAUDE.md`). For Cloud VMs, Docker Compose is simplest:

1. Start PostgreSQL: `cd packages/db && sudo docker compose up -d`
2. Push schema: `DATABASE_URL="postgresql://postgres:password@localhost:5432/folio_note" vp run db:push`

The `drizzle.config.ts` falls back to a Supabase URL on port 54322 if `DATABASE_URL` is unset. Always pass `DATABASE_URL` explicitly when running `db:push` or dev servers.

### Environment files

- `apps/server/.env` — must contain `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `apps/web/.env` — must contain `VITE_SERVER_URL`, `VITE_WEB_URL`
- Copy from `.env.example` files and fill in values. See `CLAUDE.md` for full list.

### Running dev servers

Pass `DATABASE_URL` as an env var when starting the server to avoid the Supabase fallback:

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/folio_note" vp run dev:server
vp run dev:web
```

### Gotchas

- Git hooks are managed by Vite+ (`vp config`, run via the `prepare` script) and live in `.vite-hooks/` with `core.hooksPath=.vite-hooks/_`. To skip hook setup in Cloud VMs/CI, set `VITE_GIT_HOOKS=0`.
- One pre-existing test failure exists in `apps/web/__tests__/message-list.test.tsx` (expects "Tool Calls" text that doesn't render). This is not environment-related.
- Standard commands are documented in `CLAUDE.md` (lint, test, build, type-check).

## Learned Preferences

- In React 19 (`@types/react` 19.x), `FormEvent` is deprecated — use `SubmitEvent` for `onSubmit`, `ChangeEvent` for `onChange`, `InputEvent` for `onInput`
- When adding new user-facing text, update all i18n language files (zh-CN, en-US, ja-JP) in the same change
- Japanese typing practice is a standalone full-screen route (`/jp-typing`), not nested under sidebar layout or the review route
- Japanese input matching priority: match kana (假名) first, then fall back to romaji (ローマ字)
- Background colors and component styles must use system design tokens — no hardcoded color values
- New features should reference a specific baseline commit and follow the implementation plan step by step
- Data field access from API responses needs null-checks and fallbacks for structural changes (e.g. `formatDate(updatedAt)` must tolerate missing/changed fields)
- Moonshot/Kimi K2.5 model ID is `kimi-k2.5` (dot separator), not `kimi-k2-5-thinking` (hyphenated)
- `heroui-native` rc.2+ resolves peer dependency warnings in the native app
- Use `@tanstack/react-hotkeys` for keyboard shortcut support in web components
- Page animations and transitions should integrate with system design tokens via the animate/extract skills
- `@base-ui/react` Tooltip uses `render` prop pattern for custom trigger elements, not `asChild` (unlike Radix/shadcn)
- TanStack Router route loaders use `queryClient.ensureQueryData` (not `prefetchQuery`) for consistency with project patterns
- TypeScript 7+ deprecated `baseUrl` in tsconfig — use `./` prefix in `paths` values instead (e.g. `"@/*": ["./src/*"]`)
- Vite 8 natively supports tsconfig paths — use `resolve.tsconfigPaths: true` instead of `vite-tsconfig-paths` plugin
- Monorepo packages exporting source directly (via `"default": "./src/index.ts"`) should use `noEmit: true` instead of `declaration`/`composite` to avoid Zod v4 type naming issues

@RTK.md

# Agent Guidelines for Claude Design System (CDS)

These guidelines originate from the upstream repository [`open-claude-ui`](https://github.com/Caho1/open-claude-ui), which contains a clean-room reverse-engineered implementation of Anthropic's **Claude Design System (CDS)** and its interaction physics.

When assisting users with building, modifying, or reviewing frontend components, interfaces, or animations based on this repository, you **MUST** strictly follow the design tokens, physics laws, component guidelines, and quality gates detailed below.

---

## Package Management and Local Applicability

- Use Vite+ for package management and scripts: `vp install`, `vp add <package>`, and `vp run <script>`.
- Use `vpx <command>` as the equivalent of `npx <command>` for package executables.
- The `code-examples/` paths and CDS-specific scripts below refer to the upstream CDS repository, not existing Folio files. Verify local paths before importing; use Folio's existing design tokens and component architecture when applying these guidelines.
- In Folio, run `vp run check-types` for type checking and `vp check` for the configured checks. The upstream `typecheck` and `check:tokens` scripts are not currently defined in Folio.

## 🧭 Quick Reference: Core Philosophy & Rules

1. **Editorial Warmth, Not Cyberpunk**:
   - Main brand accent is warm **Clay / Terracotta (`#d97757` in light mode, `#cc6b49` in dark mode)**.
   - Surfaces use subtle warm grays (`#fcfcfb`, `#f7f7f5`, `#1b1b19`), never stark pure black `#000` (except code blocks `#0d0d0c`) or harsh pure white `#fff`.
   - Never use neon blues, magenta, or cold purple gradients.
2. **Low-Contrast Surface Layering**:
   - Differentiate layers using micro-luminance contrast (`Surface 0 ~ 3`) and hairline borders (`border-subtle`: `rgba(0,0,0,0.06)` / `rgba(255,255,255,0.08)`).
   - Single-stroke border discipline: inside bordered containers (such as cards or the chat composer), secondary buttons and chips must NOT have redundant borders (`border-none`).
3. **Organic Motion Physics**:
   - Never use generic `linear` or exaggerated bouncy CSS transitions.
   - Use the 4 calibrated Framer Motion spring presets from [`code-examples/ClaudeMotionPresets.ts`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ClaudeMotionPresets.ts).
4. **Pure Code & Zero Copyright Violations**:
   - Zero proprietary binary fonts (`.otf`/`.ttf`) or audio files (`.mp3`/`.wav`).
   - Use the calibrated system fallback font stacks and procedural Web Audio API oscillator synthesis.
5. **Strict Edge-Case Guards**:
   - Always guard chat/composer inputs against CJK IME composition accidents (`!(e.nativeEvent.isComposing || e.keyCode === 229)`).
   - Latch scroll pinning with a 150ms cooldown timestamp to prevent LLM streaming from hijacking manual user scrolling.

---

## 🎨 1. Design Tokens & Styling Architecture

All tokens are defined in [`code-examples/cds-theme.css`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/cds-theme.css) and exposed through Tailwind classes via [`code-examples/tailwind.config.js`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/tailwind.config.js).

### Surface & Background Tokens

| Token | Light Mode Value | Dark Mode Value | Usage |
| :-- | :-- | :-- | :-- |
| `--cds-surface-0` | `#f9f9f7` | `#0b0b0b` | Base application background, page canvas (alias: `--cds-bg-surface-0`, `--cds-bg-primary`) |
| `--cds-surface-1` | `#fcfcfb` | `#151515` | Sidebar panels, secondary cards (alias: `--cds-bg-surface-1`, `--cds-bg-secondary`) |
| `--cds-surface-2` | `#ffffff` | `#1a1a19` | Input bars, dialog backdrops, floating popovers (alias: `--cds-bg-surface-2`, `--cds-bg-surface`) |
| `--cds-surface-3` | `#ffffff` | `#20201f` | Active states, hover fills, elevated tags (alias: `--cds-bg-surface-3`, `--cds-bg-surface-elevated`) |
| `--cds-surface-popover` | `#ffffff` | `#262624` | Floating popovers, dropdown menus |
| `--cds-bg-input` | `var(--cds-surface-3)` | `var(--cds-surface-3)` | Text fields, chat input background |

### Text & Border Tokens

| Token | Light Mode Value | Dark Mode Value | Usage |
| :-- | :-- | :-- | :-- |
| `--cds-text-primary` | `#151515` | `#ffffff` | Headings, primary body text, active labels |
| `--cds-text-secondary` | `#525252` | `#c2c2c2` | Timestamps, subtitles, secondary actions |
| `--cds-text-muted` | `#8a8a8a` | `#808080` | Placeholders, disabled text, hotkey hints (alias: `--cds-text-tertiary`) |
| `--cds-text-accent` | `var(--cds-clay)` | `var(--cds-clay)` | Highlighted brand terracotta text |
| `--cds-border` | `var(--cds-alpha-2)` | `var(--cds-alpha-2)` | Dividers, subtle list borders (alias: `--cds-border-subtle`, `--cds-border-card`) |
| `--cds-border-strong` | `var(--cds-alpha-3)` | `var(--cds-alpha-3)` | Emphasized component borders |
| `--cds-border-subtle` | `var(--cds-alpha-2)` | `var(--cds-alpha-2)` | Fine hairline dividers |
| `--cds-border-accent` | `var(--cds-clay)` | `var(--cds-clay)` | Focus and active borders |

### Brand Clay Palette

- `--brand`: `#c6613f` (Official desktop brand primary color)
- `--cds-clay`: `#d97757` (Light / pulse indicator) / `#cc6b49` (Dark)
- Focus shadow: `var(--cds-focus-shadow)` (`inset 0 0 0 1px var(--cds-surface-1), 0 0 0 1.5px var(--cds-clay), 0 0 6px 1px rgba(217, 119, 87, 0.25)`)

### Geometric Corner Radii

- `var(--cds-radius)`: `8px` (Base component radius)
- `var(--radius-card)` / `--cds-card-radius`: `calc(var(--cds-radius, 8px) + calc(.25rem * var(--cds-rem-scale, 1)))` (12px standard / concentric card radius, alias: `--cds-radius-card`)
- `--cds-radius-composer`: `20px` (Main chat composer terminal)
- `--cds-panel-radius`: `10px` (Panels, attachment cards)
- `--df-radius-pill` / `--cds-radius-pill`: `999px` / `9999px` (Pill buttons, segmented control tracks)
- `--cds-message-bubble-radius`: `calc(var(--cds-radius, 8px) + calc(.25rem * var(--cds-rem-scale, 1)))` (User message bubble radius, alias: `--cds-radius-message-bubble`)
- Precision scale: `--radius-xs` (2px), `--radius-sm` (4px), `--radius-md` (6px, alias: `--cds-radius-btn-xs`), `--radius-lg` (8px, alias: `--cds-radius-btn-md`), `--radius-xl` (12px, alias: `--cds-radius-code`), `--radius-2xl` (16px, alias: `--cds-radius-dialog`), `--radius-3xl` (24px)

---

## ⚡ 2. Motion Physics & Spring Presets

Always import canonical spring presets from [`code-examples/ClaudeMotionPresets.ts`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ClaudeMotionPresets.ts) instead of hardcoding random transition parameters.

```typescript
import {
  SPRING_BOUNCY,
  SPRING_SNAPPY,
  SPRING_GENTLE,
  SPRING_HEAVY_SNAP
} from "./ClaudeMotionPresets"
```

### The 4 Canonical Spring Presets

1. **`SPRING_SNAPPY`** (`stiffness: 600, damping: 30, mass: 0.6`, $\zeta = 0.791$):
   - **Overshoot**: `+1.8%`, settle time: `~0.22s`.
   - **Where to use**: Primary button clicks, segmented control pill switching (`layoutId`), tabs, micro-interactions.
2. **`SPRING_BOUNCY`** (`stiffness: 400, damping: 25, mass: 0.8`, $\zeta = 0.612$):
   - **Overshoot**: `+8.8%`, settle time: `~0.38s`.
   - **Where to use**: Toggle switches, badge growth entrances, success confirmation pop-ins.
3. **`SPRING_GENTLE`** (`stiffness: 220, damping: 24, mass: 1.0`, $\zeta = 0.809$):
   - **Overshoot**: `+1.5%`, settle time: `~0.48s`.
   - **Where to use**: Modals, Thinking Accordion height expansion, message bubble entry, split-pane 50/50 reset.
4. **`SPRING_HEAVY_SNAP`** (`stiffness: 1200, damping: 80, mass: 0.1`, $\zeta = 1.826$, overdamped):
   - **Overshoot**: `0%` (Zero overshoot).
   - **Where to use**: Session item drag-and-drop placeholder collision, magnetic drawer snapping.

### 7-Stop Non-Linear Fade Mask

Never use a linear gradient for scroll fading. Use the calibrated 7-stop non-linear mask:

```css
mask-image: linear-gradient(
  to bottom,
  transparent 0%,
  rgba(0, 0, 0, 0.05) 15%,
  rgba(0, 0, 0, 0.18) 32%,
  rgba(0, 0, 0, 0.38) 50%,
  rgba(0, 0, 0, 0.64) 68%,
  rgba(0, 0, 0, 0.88) 85%,
  black 100%
);
```

See [`code-examples/ScrollFadeContainer.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ScrollFadeContainer.tsx) for dynamic top/bottom edge zeroing logic.

---

## 🧩 3. Component Directory: 30 Production Modules

Refer to or import from [`code-examples/`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/) when composing UI:

### Atomic Controls (5)

- [`CdsButton.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/CdsButton.tsx): 4-tier ladder (XS: 24/6px, SM: 28/8px, MD: 32/8px, LG: 40/12px), 5 variants (Primary, Secondary, Ghost, Outline, Danger).
- [`SegmentedControl.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/SegmentedControl.tsx): 9999px rounded pill track, 2px geometric padding, CSS & Framer Motion dual-mode.
- [`StatusIndicators.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/StatusIndicators.tsx): Clay 2.4s breathing light, 1.2s active run pulse, 3-dot wave, skeleton sweep.
- [`ConfirmationDialog.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ConfirmationDialog.tsx): 16px corner radius, dual-ring popover shadow, focus trap.
- [`AttachmentCard.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/AttachmentCard.tsx): 10px panel radius, desktop card grid (128×96px) and inline composer pill dual-mode.

### Conversation Stream & Input (6)

- [`ChatComposer.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ChatComposer.tsx): 20px core input terminal, dual-ring focus shadow, `field-sizing: content` auto-resize.
- [`ChatMessageBubbles.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ChatMessageBubbles.tsx): User 18px radius with soft tint vs Assistant zero-border transparent layout.
- [`ThinkingAccordion.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ThinkingAccordion.tsx): Framer Motion height spring expansion, single clay breathing pulse dot, active generation mutex.
- [`RichComposerWithMentions.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/RichComposerWithMentions.tsx): CJK IME composition guard, `/` command & `@` context dual triggers, token budget estimator.
- [`ModelSwitcherWithTokenGauge.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ModelSwitcherWithTokenGauge.tsx): 3-tier model switcher, Extended Thinking toggle, Prompt Caching 4-color memory SVG gauge.
- [`McpToolDecisionCard.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/McpToolDecisionCard.tsx): 3-state authorization lifecycle (`pending_approval` → `running` → `success`/`error`), 3-tier action array.

### Atmosphere & Motion (3)

- [`ClaudeMotionPresets.ts`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ClaudeMotionPresets.ts): 4 calibrated physics presets.
- [`ReasoningAmbientGlow.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ReasoningAmbientGlow.tsx): Warm Clay diffuse light field, `cds-shimmer-text-shine` asymmetric sweep, caustic canvas.
- [`ScrollFadeContainer.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ScrollFadeContainer.tsx): 7-stop non-linear mask with edge sensors.

### Audiovisual & Media (8)

- [`ClaudeAudioPlayer.ts`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ClaudeAudioPlayer.ts): Procedural Web Audio API oscillator synthesis, 30% gentle volume standard, anti-pop gain ramp smoothing.
- [`LiveMicActivityBars.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/LiveMicActivityBars.tsx): 6-band speech spectrum visualizer (85Hz-4.8kHz), 8% noise floor gate, `Math.pow(energy, 0.7)` non-linear Gamma power compression.
- [`MediaLightboxViewer.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/MediaLightboxViewer.tsx): 75vw runway viewport, cursor-anchored affine pan/zoom equation, 4px drag deadzone, Ctrl + wheel zooming.
- [`useClaudeSharedElementTransition.ts`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/useClaudeSharedElementTransition.ts): `startViewTransition` wrapper with dynamic corner radius detection and `object-fit: contain` clip calculation.
- [`ArtifactsSplitPaneResizer.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ArtifactsSplitPaneResizer.tsx): Iframe pointer shield, 4px deadzone, double-click 50/50 spring snap, collapse thresholds.
- [`EpitaxyIframeBridge.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/EpitaxyIframeBridge.tsx): Strict Origin validation & channel-isolated postMessage RPC, user-gesture gating (`navigator.userActivation`).
- [`StreamingDiffViewer.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/StreamingDiffViewer.tsx): Table line-number alignment with `tabular-nums`, incremental streaming pipeline, unified/split view, 2.5s copy cooldown.
- [`CodeBlock.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/CodeBlock.tsx): 12px radius, `#0d0d0c` solid black background, inline optical alignment for language tags.

### Desktop & System Architecture (8)

- [`createClaudeMainWindow.ts`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/createClaudeMainWindow.ts): Electron host window factory: `hiddenInset` titlebar, macOS Vibrancy (`under-window`) glass blending, 1200×800 default, 600×400 min.
- [`ClaudeDesktopHeader.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ClaudeDesktopHeader.tsx): macOS traffic light 74px inverse zoom compensation slot (`ew = 74`), 45px global drag band.
- [`DraggableSessionList.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/DraggableSessionList.tsx): `pinnedOrder` optimistic topological reordering, 4px deadzone, tilted ghost shadow.
- [`CoworkAgentCanvas.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/CoworkAgentCanvas.tsx): Multi-agent task delegation state machine, team-shared artifact asset pool, cross-window `BroadcastChannel` sync.
- [`useClaudeScrollPinning.ts`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/useClaudeScrollPinning.ts): 150ms cooldown latch against scroll hijacking, 40px bottom-tolerance scroll pin, GPU subpixel blur elimination.
- [`ContainerResponsiveBar.tsx`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/ContainerResponsiveBar.tsx): `@container`-driven 4-tier fluid compression matrix (>=576px / <480px / <384px / <320px), preventing glyph breaks.
- [`useClaudeRovingFocus.ts`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/useClaudeRovingFocus.ts): W3C WAI-ARIA compliance: 1D & 2D arrow key grid navigation, Home/End boundary jumps.
- [`useRateLimitBackoff.ts`](https://github.com/Caho1/open-claude-ui/blob/HEAD/code-examples/useRateLimitBackoff.ts): 429/503 truncated exponential backoff (`t = min(t_max, t_base * 2^a) * (1 ± J)`), full jitter, circuit breaker.

---

## 🛡️ 4. Agent Coding Invariants (Do's and Don'ts)

### ✅ DO

1. **Always use semantic tokens**: Use `var(--cds-bg-surface-0)` or Tailwind classes (`bg-surface-0`, `text-primary`, `bg-clay-500`) instead of arbitrary hardcoded HEX values.
2. **Apply `tabular-nums` for dynamic numbers**: Every timer, countdown, token counter, audio frequency indicator, and line number MUST use `tabular-nums` (or `font-mono`) to prevent layout jitter.
3. **Guard CJK IME inputs**:
   ```typescript
   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
     if (e.nativeEvent.isComposing || e.keyCode === 229) return
     if (e.key === "Enter" && !e.shiftKey) {
       e.preventDefault()
       handleSendMessage()
     }
   }
   ```
4. **Support Dark Mode**: Always test that UI looks correct under both light (`:root`) and dark mode (`.dark`).
5. **Enforce Single-Stroke Borders**: If a container has a border, its internal action buttons or chips should have `border-none`.

### ❌ DON'T

1. **Never introduce raw linear jumps**: Do not write `transition: all 0.3s linear` or `transition: all 0.5s ease`. Use Framer Motion springs or the calibrated cubic-bezier curves (`[0.16, 1, 0.3, 1]`).
2. **Never commit binary assets**: Never introduce `.ttf`, `.otf`, `.mp3`, or `.wav` files into the repository.
3. **Never bypass Sandbox Security**: Never add `allow-same-origin` to an iframe bridge running arbitrary LLM-generated HTML.
4. **Never hijack scroll during streaming**: Do not force-scroll to bottom if `Date.now() - lastUserScrollTime < 150ms`.

---

## 🧪 5. Verification & Quality Gates

When modifying code in the upstream CDS repository, run the following verification commands. For Folio, use the local checks listed above and run `vp run build` when build verification is relevant:

```bash
# 1. Typecheck the entire project
vp run typecheck

# 2. Verify design token consistency
vp run check:tokens

# 3. Build library output
vp run build
```

All commands must exit with code 0 and output **0 errors**.

---

## 🔌 6. Runtime Portability & Host Bridging (运行时分层与宿主桥接)

To maximize consumption surface across different host environments (e.g. non-React web apps, Electron desktop harnesses like DSH, or custom plugin shells), the repository assets are structured into 3 portability tiers:

### 1. The Three Portability Tiers

- 🎨 **Pure CSS (Tokens & Shaders)**: Zero JavaScript runtime dependency. Includes `code-examples/cds-theme.css`, CSS-driven scroll fade (`.cds-scroll-fade`), breathing lights (`.cds-dot-breathe`), and skeleton sweeps. Can be consumed by any HTML/CSS project directly.
- ⚡ **Pure Logic / Headless**: Pure math and browser APIs without React UI bindings. Includes `code-examples/ClaudeMotionPresets.ts` (spring formulas), `code-examples/ClaudeAudioPlayer.ts` (Web Audio synthesis), `code-examples/useClaudeScrollPinning.ts`, and `code-examples/useRateLimitBackoff.ts`.
- ⚛️ **React Components**: Stateful, interactive UI controls relying on React hooks/refs. Includes `MediaLightboxViewer.tsx`, `DraggableSessionList.tsx`, `McpToolDecisionCard.tsx`, `ChatComposer.tsx`, etc.

### 2. Host Bridge Mapping Pattern (宿主别名桥接)

If your host application uses a custom design token prefix (e.g., `--app-*` or `--dsw-*`), bridge to CDS by defining aliases in your host stylesheet:

```css
/* Host application stylesheet */
:root {
  --app-brand-primary: var(--brand); /* #c6613f */
  --app-brand-accent: var(--cds-clay); /* #d97757 */
  --app-bg-canvas: var(--cds-surface-0); /* #f9f9f7 / #0b0b0b */
  --app-bg-card: var(--cds-surface-2); /* #ffffff / #1a1a19 */
  --app-border-base: var(--cds-border); /* hairline divider */
  --app-radius-card: var(--radius-card); /* concentric card radius */
  --app-shadow-composer: var(
    --cds-shadow-composer
  ); /* composer diffuse shadow */
}
```
