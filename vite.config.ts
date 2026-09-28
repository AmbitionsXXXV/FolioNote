import ultracite from "ultracite/oxfmt"
import ultraciteCoreConfig from "ultracite/oxlint/core"
import ultraciteReactConfig from "ultracite/oxlint/react"
import ultraciteTanstackConfig from "ultracite/oxlint/tanstack"
import { defineConfig } from "vite-plus"

const sharedIgnores = [
  ".agents/**/*",
  ".claude/**/*",
  ".cursor/**/*",
  ".gemini/**/*",
  "**/.turbo/**",
  "**/.vite/**",
  "**/.output/**",
  "**/.expo/**",
  "**/dist/**",
  "**/dev-dist/**",
  "**/.source/**",
  "**/.react-email/**",
  "**/convex/_generated/**",
  "**/routeTree.gen.ts",
  "**/uniwind-types.d.ts",
  "**/*.lock",
  "tools/clean.js"
]

// ultracite ships rules for plugins that the bundled oxlint doesn't support yet;
// drop individual rules AND entire plugin prefixes until the runtime catches up.
const incompatibleOxlintRules = [
  "prefer-named-capture-group",
  "jsdoc/require-yields-description",
  "typescript/method-signature-style",
  "react/react-compiler"
]
const incompatibleOxlintPlugins = ["github", "react-doctor", "sonarjs"]

const lintRules = {
  ...ultraciteCoreConfig.rules,
  ...ultraciteReactConfig.rules,
  ...ultraciteTanstackConfig.rules,
  "eslint/func-style": "off" as const,
  "eslint/no-use-before-define": "off" as const,
  "eslint/sort-keys": "off" as const
}

for (const rule of incompatibleOxlintRules) {
  delete lintRules[rule]
}
for (const key of Object.keys(lintRules)) {
  if (incompatibleOxlintPlugins.some((p) => key.startsWith(`${p}/`))) {
    delete lintRules[key]
  }
}

// Rules the prior Biome config tolerated. The existing codebase predates this
// stricter oxlint preset, so these are relaxed to keep `vp check` green after
// the migration's auto-fix pass. Tighten incrementally over time.
const relaxedRules = [
  "eslint/arrow-body-style",
  "eslint/class-methods-use-this",
  "eslint/complexity",
  "eslint/curly",
  "eslint/eqeqeq",
  "eslint/no-await-in-loop",
  "eslint/no-empty-function",
  "eslint/no-eq-null",
  "eslint/no-inline-comments",
  "eslint/no-loop-func",
  "eslint/no-negated-condition",
  "eslint/no-redeclare",
  "eslint/no-param-reassign",
  "eslint/no-plusplus",
  "eslint/no-promise-executor-return",
  "eslint/no-shadow",
  "eslint/no-unsafe-optional-chaining",
  "eslint/no-unused-vars",
  "eslint/no-useless-return",
  "eslint/prefer-destructuring",
  "eslint/require-await",
  "eslint/require-unicode-regexp",
  "import/first",
  "import/no-cycle",
  "import/no-named-as-default",
  "import/no-named-as-default-member",
  // a11y rules the prior Biome config also disabled
  "jsx-a11y/control-has-associated-label",
  "jsx-a11y/interactive-supports-focus",
  "jsx-a11y/no-noninteractive-element-interactions",
  "jsdoc/check-tag-names",
  "node/callback-return",
  "node/global-require",
  "oxc/no-barrel-file",
  "promise/avoid-new",
  "promise/prefer-await-to-callbacks",
  "promise/prefer-await-to-then",
  "react/no-object-type-as-default-prop",
  "react/no-unstable-nested-components",
  "typescript/array-type",
  "typescript/ban-ts-comment",
  "typescript/consistent-type-imports",
  "typescript/no-dynamic-delete",
  "typescript/no-explicit-any",
  "unicorn/consistent-function-scoping",
  "unicorn/custom-error-definition",
  "unicorn/escape-case",
  "unicorn/import-style",
  "unicorn/no-anonymous-default-export",
  "unicorn/no-array-reduce",
  "unicorn/no-document-cookie",
  "unicorn/no-empty-file",
  "unicorn/no-hex-escape",
  "unicorn/no-immediate-mutation",
  "unicorn/no-negated-condition",
  "unicorn/no-useless-undefined",
  "unicorn/prefer-add-event-listener",
  "unicorn/prefer-array-find",
  "unicorn/prefer-dom-node-remove",
  "unicorn/prefer-module",
  "unicorn/prefer-native-coercion-functions",
  // getElementById is intentional for numeric-leading heading ids (e.g. dates),
  // which are valid ids but invalid CSS selectors for querySelector("#...").
  "unicorn/prefer-query-selector",
  "unicorn/prefer-spread",
  "unicorn/prefer-string-replace-all",
  "unicorn/prefer-ternary",
  "unicorn/switch-case-braces",
  // Rules newly promoted to error by ultracite upgrade; relax until codebase is
  // updated to comply. Tighten incrementally.
  "jsx-a11y/prefer-tag-over-role",
  "oxc/branches-sharing-code",
  "react/display-name",
  "react/jsx-no-constructed-context-values",
  "react/jsx-handler-names",
  "react/no-danger",
  "react/no-unescaped-entities",
  // Oxlint 1.85 adds React rules that flag existing component patterns.
  // Keep the Vite+ upgrade scoped to the toolchain.
  "react/capitalized-calls",
  "react/exhaustive-effect-dependencies",
  "react/function-component-definition",
  "react/immutability",
  "react/memo-dependencies",
  "react/preserve-manual-memoization",
  "react/purity",
  "react/refs",
  "react/rule-suppression",
  "react/set-state-in-effect",
  "react/static-components",
  "react/todo",
  "react-hooks/exhaustive-deps",
  "unicorn/prefer-export-from",
  "unicorn/prefer-number-coercion",
  "jsx-a11y/heading-has-content",
  "react/hook-use-state",
  "react/jsx-no-useless-fragment",
  "react/no-react-children",
  "unicorn/prefer-single-call"
]

for (const rule of relaxedRules) {
  lintRules[rule] = "off"
}

export default defineConfig({
  fmt: {
    ...ultracite,
    ignorePatterns: [...(ultracite.ignorePatterns ?? []), ...sharedIgnores],
    semi: false,
    sortTailwindcss: {
      attributes: ["className"],
      stylesheet: "packages/ui/src/styles/index.css"
    },
    trailingComma: "none"
  },
  lint: {
    env: ultraciteCoreConfig.env,
    ignorePatterns: [
      ...(ultraciteCoreConfig.ignorePatterns ?? []),
      ...sharedIgnores
    ],
    overrides: [
      ...(ultraciteCoreConfig.overrides ?? []),
      ...(ultraciteTanstackConfig.overrides ?? [])
    ].map((o) => {
      if (!o.rules) return o
      const cleaned = { ...o.rules }
      for (const key of Object.keys(cleaned)) {
        if (incompatibleOxlintPlugins.some((p) => key.startsWith(`${p}/`))) {
          delete cleaned[key]
        }
      }
      return { ...o, rules: cleaned }
    }),
    plugins: [
      ...(ultraciteCoreConfig.plugins ?? []),
      ...(ultraciteReactConfig.plugins ?? [])
    ],
    rules: lintRules
  },
  staged: {
    "*.{css,js,jsx,json,jsonc,ts,tsx,cjs,mjs}": "vp check --fix"
  },
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    // Vitest v4 compatibility: keep separate Vite servers for inline projects.
    // Remove when plugins and config hooks can run once for shared projects.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#inline-projects-share-the-vite-server-by-default
    sharedViteServer: false,
    coverage: {
      exclude: [
        "**/node_modules/**",
        "**/__tests__/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/dist/**",
        "**/migrations/**",
        "**/*.d.ts"
      ],
      include: ["**/src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    projects: [
      "./apps/web/vite.config.ts",
      "./apps/server/vite.config.ts",
      {
        // Vitest v4 compatibility: keep this inline project independent of the root config.
        // Remove to inherit root options, including plugins and setup files.
        // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
        // https://vitest.dev/guide/migration/#inline-projects-inherit-the-root-config-by-default
        extends: false,
        test: {
          // Vitest v4 compatibility: preserve mock call history.
          // Remove after tests no longer rely on calls from setup or earlier tests.
          // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
          // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
          clearMocks: false,
          environment: "node",
          globals: true,
          include: ["**/__tests__/**/*.test.tsx", "**/*.spec.tsx"],
          name: "native",
          root: "./apps/native"
        }
      },
      {
        // Vitest v4 compatibility: keep this inline project independent of the root config.
        // Remove to inherit root options, including plugins and setup files.
        // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
        // https://vitest.dev/guide/migration/#inline-projects-inherit-the-root-config-by-default
        extends: false,
        test: {
          // Vitest v4 compatibility: preserve mock call history.
          // Remove after tests no longer rely on calls from setup or earlier tests.
          // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
          // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
          clearMocks: false,
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**", "**/.react-email/**"],
          globals: true,
          include: ["**/__tests__/**/*.test.ts", "**/*.spec.ts"],
          name: "packages",
          root: "./packages"
        }
      }
    ]
  }
})
