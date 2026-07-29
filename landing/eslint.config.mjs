import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Munaxa Landing Page ESLint (flat config). Fully self-contained — TypeScript
 * type-checked rules, Next.js core-web-vitals, React hooks, and the Munaxa
 * design-token guardrails.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
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
    // Design-system guardrail: no hardcoded hex colors — use token classes (text-coral, bg-card,
    // border-border, …). Tokens live in tailwind.config.ts + globals.css.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/]',
          message:
            'No hardcoded hex colors — use design-system token classes (e.g. text-coral, bg-card, border-border). Tokens: tailwind.config.ts + globals.css.',
        },
        {
          selector:
            'TemplateElement[value.raw=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/]',
          message:
            'No hardcoded hex colors — use design-system token classes (e.g. text-coral, bg-card, border-border). Tokens: tailwind.config.ts + globals.css.',
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
