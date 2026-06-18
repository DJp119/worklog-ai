// server/eslint.config.js
//
// Flat config for the Express server. TypeScript-aware linting using the
// @typescript-eslint/parser (added as a devDependency).
//
// TypeScript-specific lint rules are intentionally NOT enabled —
// the `npm run typecheck` script (`tsc`) is the canonical type-safety
// gate. This file only catches the JS-level issues that tsc would not.

import js from '@eslint/js'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'

export default [
  { ignores: ['dist/**', 'dist-stale/**', 'node_modules/**', 'coverage/**', '**/*.d.ts'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        // Project-less mode: faster, but no type-aware rules. We use it
        // because we deliberately keep this config JS-only (no
        // @typescript-eslint/eslint-plugin) and rely on `tsc` for types.
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.node, ...globals.es2021 },
    },
    rules: {
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
]
