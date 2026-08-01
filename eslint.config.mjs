import root from '@munaxa/config-eslint/root.js';

/**
 * Root ESLint flat config. A fast, non-type-checked safety net used when ESLint is invoked
 * from the repo root (notably the pre-commit lint-staged sweep). Each app/package defines its
 * own stricter, type-aware eslint.config.mjs, which takes precedence under `turbo lint`.
 */
export default [
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.turbo/**',
      'apps/mobile/**',
      'infra/**', // ops/load-test scripts (e.g. k6) run outside the app toolchain
      '**/*.config.{js,mjs,cjs,ts}',
      '**/*.d.ts',
    ],
  },
  ...root,
];
