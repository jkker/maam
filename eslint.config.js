import { resolve } from 'node:path'

import { includeIgnoreFile } from '@eslint/compat'
import js from '@eslint/js'
import vitest from '@vitest/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier/flat'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importX from 'eslint-plugin-import-x'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'
import ts from 'typescript-eslint'

const config = defineConfig(
  globalIgnores(['public', 'tmp', 'client/dev-dist']),
  includeIgnoreFile(resolve(import.meta.dirname, '.gitignore')),
  {
    name: 'base',
    files: ['eslint.config.js', './server/src/**/*', './server/test/**/*', './client/src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ts.configs.recommendedTypeChecked,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
      prettier,
    ],
    plugins: { 'unused-imports': unusedImports },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: './tsconfig.json' })],
    },
    languageOptions: {
      parserOptions: {
        projectService: {},
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.es2026, ...globals.node },
    },
    rules: {
      'no-useless-rename': 'warn',
      'object-shorthand': ['warn', 'properties'],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      // imports
      'import-x/order': [
        'warn',
        {
          groups: ['type', 'builtin', 'external', 'internal', ['parent', 'sibling'], 'index'],
          alphabetize: {
            order: 'asc',
            orderImportKind: 'asc',
            caseInsensitive: true,
          },
          'newlines-between': 'always-and-inside-groups',
          sortTypesGroup: true,
          consolidateIslands: 'inside-groups',
        },
      ],
      /** Disabled as TypeScript provides the same checks.
       * @see https://typescript-eslint.io/troubleshooting/typed-linting/performance/#eslint-plugin-import
       */
      'import-x/namespace': 0,
      'import-x/named': 0,
      'import-x/default': 0,
      'import-x/no-named-as-default-member': 0,
      'import-x/no-named-as-default': 0,
      'import-x/no-unresolved': 0,
      'import-x/no-useless-path-segments': 'warn',
      'import-x/no-empty-named-blocks': 'warn',
      // 'import-x/no-cycle': 'error', // very computationally expensive; use sparingly
      // Unused imports
      '@typescript-eslint/no-unused-vars': 0,
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ['**/*.{test,spec}.*'],
    ...vitest.configs.recommended,
  },
  {
    files: ['./client/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: {
      parserOptions: {
        projectService: {},
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.es2026, ...globals.browser },
    },
  },
  {
    files: ['./client/src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
)
export default config
