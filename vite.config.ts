import arkenvVitePlugin from '@arkenv/vite-plugin'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { devtools as tanstackDevtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { type } from 'arkenv'
import { defineConfig } from 'vite-plus'
import { playwright } from 'vite-plus/test/browser-playwright'

export const Env = type({
  PORT: 'number.port = 5173',
  DEVTOOLS: 'boolean = false',
  'VITE_API_URL?': 'string.url',
  'VITE_APP_NAME?': 'string',
  VITE_ENABLE_DEBUGGING: 'boolean = false',
  VITE_API_TIMEOUT: '1000 <= number.integer <= 60000 = 5000',
})

const CI = !!process.env.CI

export default defineConfig({
  plugins: [
    tanstackDevtools(),
    tanstackRouter({ target: 'react' }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    arkenvVitePlugin(Env),
  ],
  devtools: { enabled: process.env.DEVTOOLS === 'true' },
  optimizeDeps: {
    include: ['i18next', 'i18next-browser-languagedetector', 'i18next-http-backend'],
  },
  server: { port: Number(process.env.PORT) || 5173 },

  // ── Format (oxfmt) ────────────────────────────────────────────────
  fmt: {
    ignorePatterns: [
      '**/routeTree.gen.ts',
      '.nx',
      '.tanstack',
      'dist',
      'node_modules',
      'storybook-static',
      'pnpm-lock.yaml',
      'assets',
    ],
    tabWidth: 2,
    useTabs: false,
    semi: false,
    trailingComma: 'all',
    singleQuote: true,
    printWidth: 100,
    sortPackageJson: true,
    sortImports: {
      partitionByComment: true,
      internalPattern: ['#/'],
    },
    sortTailwindcss: {
      functions: ['clsx', 'cn', 'cva'],
      stylesheet: 'src/index.css',
    },
  },

  // ── Lint (oxlint) ─────────────────────────────────────────────────
  lint: {
    plugins: ['unicorn', 'eslint', 'typescript', 'oxc', 'import', 'promise', 'react', 'react-perf'],
    categories: { correctness: 'deny', suspicious: 'warn' },
    env: { builtin: true, es2026: true, browser: true },
    rules: {
      curly: ['warn', 'multi-line'],
      'no-useless-rename': 'warn',
      'arrow-body-style': 'warn',
      'no-var': 'deny',
      'no-shadow': 'off',
      'no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      'react/rules-of-hooks': 'deny',
      'react/exhaustive-deps': 'warn',
      'react/only-export-components': ['warn', { allowConstantExport: true }],
      'react/react-in-jsx-scope': 'off',
      'react/self-closing-comp': 'warn',
      'react/jsx-no-useless-fragment': 'warn',
      'react/button-has-type': 'warn',
      'react/jsx-fragments': 'warn',
      'react/jsx-boolean-value': 'warn',
      'react/jsx-curly-brace-presence': [
        'warn',
        { props: 'never', children: 'never', propElementValues: 'always' },
      ],

      'import/export': 'deny',
      'import/no-duplicates': 'warn',
      'import/no-cycle': 'deny',
      'import/no-named-default': 'warn',
      'import/namespace': 'off',
      'import/default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-named-as-default': 'off',
      'import/no-unassigned-import': 'off',

      'typescript/no-inferrable-types': 'warn',
      'typescript/no-import-type-side-effects': 'error',
      'typescript/array-type': ['warn', { default: 'array-simple' }],
      'typescript/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      'typescript/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
      'typescript/no-confusing-non-null-assertion': 'error',
      'typescript/no-extraneous-class': 'error',
      'typescript/no-explicit-any': 'deny',
      'typescript/no-redundant-type-constituents': 'warn',
      'typescript/no-useless-empty-export': 'warn',
      'typescript/prefer-as-const': 'warn',
      'typescript/no-this-alias': 'warn',
      'typescript/no-unsafe-argument': 'deny',
      'typescript/no-unsafe-assignment': 'deny',
      'typescript/no-unsafe-call': 'deny',
      'typescript/no-unsafe-member-access': 'deny',
      'typescript/no-unsafe-return': 'deny',
      'typescript/no-unsafe-type-assertion': 'off',
      'typescript/prefer-function-type': 'error',
      'typescript/prefer-nullish-coalescing': 'error',
      'typescript/no-base-to-string': 'warn',
      'typescript/restrict-template-expressions': 'warn',
      'typescript/unbound-method': 'warn',

      'unicorn/no-array-for-each': 'warn',
      'unicorn/prefer-array-find': 'warn',
      'unicorn/require-post-message-target-origin': 'off',

      'promise/param-names': 'deny',
    },
    settings: {
      'jsx-a11y': { components: {}, attributes: {} },
      react: { formComponents: [], linkComponents: ['Link'], version: '19.2' },
      vitest: { typecheck: true },
    },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ['**/*.{test,spec}.*', '**/tests/**/*.*', 'docs/storybook/.storybook/*'],
        plugins: ['vitest'],
        rules: {
          'unicorn/consistent-function-scoping': 'off',
          'typescript/no-explicit-any': 'off',
          'typescript/no-unsafe-argument': 'off',
          'typescript/no-unsafe-assignment': 'off',
          'typescript/no-unsafe-call': 'off',
          'typescript/no-unsafe-member-access': 'off',
          'typescript/no-unsafe-return': 'off',
          'typescript/no-unsafe-type-assertion': 'off',
          'react/rules-of-hooks': 'off',
        },
      },
      {
        files: ['**/components/ui/**/*.{ts,tsx}', '**/hooks/**/*.{ts,tsx}', '**/lib/**/*.{ts,tsx}'],
        rules: { 'react/only-export-components': 'off' },
      },
      {
        files: ['**/*.stories.*', '**/storybook/**/*.*'],
        rules: { 'react/rules-of-hooks': 'off' },
      },
      {
        files: ['src/**/*.{ts,tsx}'],
        jsPlugins: [{ name: 'react-hooks-js', specifier: 'eslint-plugin-react-hooks' }],
        rules: {
          'react-hooks-js/component-hook-factories': 'error',
          'react-hooks-js/config': 'error',
          'react-hooks-js/error-boundaries': 'error',
          'react-hooks-js/gating': 'error',
          'react-hooks-js/globals': 'error',
          'react-hooks-js/immutability': 'error',
          'react-hooks-js/incompatible-library': 'off',
          'react-hooks-js/preserve-manual-memoization': 'error',
          'react-hooks-js/purity': 'error',
          'react-hooks-js/refs': 'error',
          'react-hooks-js/set-state-in-effect': 'error',
          'react-hooks-js/set-state-in-render': 'error',
          'react-hooks-js/static-components': 'error',
          'react-hooks-js/unsupported-syntax': 'error',
          'react-hooks-js/use-memo': 'error',
          'react-hooks-js/void-use-memo': 'error',
          'react-hooks-js/automatic-effect-dependencies': 'error',
          'react-hooks-js/capitalized-calls': 'error',
          'react-hooks-js/fbt': 'off',
          'react-hooks-js/fire': 'off',
          'react-hooks-js/hooks': 'error',
          'react-hooks-js/invariant': 'error',
          'react-hooks-js/memoized-effect-dependencies': 'error',
          'react-hooks-js/no-deriving-state-in-effects': 'error',
          'react-hooks-js/rule-suppression': 'off',
          'react-hooks-js/syntax': 'error',
          'react-hooks-js/todo': 'off',
        },
      },
    ],
    ignorePatterns: [
      'public',
      'tmp',
      'dist',
      'build',
      'node_modules',
      '.turbo',
      '.tanstack',
      '**/routeTree.gen.ts',
    ],
  },

  // ── Staged (pre-commit) ───────────────────────────────────────────
  staged: {
    '*.{js,ts,jsx,tsx}': 'vp check --fix',
    '*.{json,md,css,html,yml,yaml}': 'vp fmt',
  },

  // ── Test (vitest) ─────────────────────────────────────────────────
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['./**/*.test.tsx', './**/*.test.browser.{ts,tsx}'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            trace: 'on-first-retry',
          },
        },
        optimizeDeps: { include: ['react-dom/client'] },
      },
    ],
    silent: 'passed-only',
    reporters: CI ? ['default', 'junit'] : [],
    outputFile: { junit: 'junit-test-report.xml' },
    coverage: {
      reportsDirectory: './coverage',
      exclude: ['src/components/ui/*', 'routeTree.gen.ts'],
      reporter: CI ? ['text', 'cobertura', 'lcov'] : ['html', 'text'],
    },
  },
})
