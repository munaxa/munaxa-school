import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Munaxa Demo ESLint (flat config) — mirrors the Landing app: TypeScript type-checked rules,
 * Next.js core-web-vitals, React hooks, and the Munaxa design-token guardrail (no hardcoded
 * hex colors — use token classes / @axa/platform/tokens).
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // Design-system guardrail: no hardcoded hex colors — use token classes (bg-primary,
    // text-foreground, …) whose values come from @axa/platform/tokens.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/seed/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/]',
          message:
            'No hardcoded hex colors — use token classes (bg-primary, text-foreground, …) or @axa/platform/tokens.',
        },
        {
          selector:
            'TemplateElement[value.raw=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/]',
          message:
            'No hardcoded hex colors — use token classes (bg-primary, text-foreground, …) or @axa/platform/tokens.',
        },
      ],
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'cloudflare-env.d.ts',
      '.open-next/**',
      '.wrangler/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '*.config.*',
    ],
  },
  prettier,
);
