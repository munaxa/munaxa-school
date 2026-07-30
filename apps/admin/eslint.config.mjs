import next from '@axa/config-eslint/next.js';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Admin Portal ESLint (flat config). Uses the shared Munaxa base plus the official
 * Next.js and React Hooks rules. Self-contained so `eslint .` and editors behave
 * identically (no reliance on the legacy `next lint` config patching).
 */
export default [
  ...next,
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
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    /*
     * "Unused disable directive" is not trustworthy in this app, so it must never be autofixed.
     *
     * Several rules — `no-unnecessary-type-assertion` above all — depend on `.next/types`, which
     * `next build` generates. Lint after a build and the rule goes quiet, so its suppression looks
     * unused; lint on a clean checkout (which is what CI does) and the same suppression is load
     * bearing. With the default `warn`, `eslint --fix` in the pre-commit hook deletes directives
     * that CI then fails without. Turning the report off keeps the fixer's hands off them.
     */
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    // Platform governance guardrails: app source must use Platform token classes — never
    // hardcoded hex colors nor raw Tailwind palette colors. Tokens come from
    // @axa/platform/tokens + globals.css.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/]',
          message:
            'No hardcoded hex colors — use design-system token classes (e.g. text-coral, bg-card, border-border). Tokens: @axa/platform/tokens (css/theme.oklch.css) + globals.css.',
        },
        {
          selector:
            'TemplateElement[value.raw=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/]',
          message:
            'No hardcoded hex colors — use design-system token classes (e.g. text-coral, bg-card, border-border). Tokens: @axa/platform/tokens (css/theme.oklch.css) + globals.css.',
        },
        {
          selector:
            'Literal[value=/\\b(?:bg|text|border|ring|divide|from|via|to|fill|stroke|outline|accent|caret|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\\b/]',
          message:
            'No raw Tailwind palette colors — use design-system token/semantic classes (bg-primary, text-muted-foreground, bg-success, text-warning, …). Tokens: @axa/platform/tokens (css/theme.oklch.css) + globals.css.',
        },
        {
          selector:
            'TemplateElement[value.raw=/\\b(?:bg|text|border|ring|divide|from|via|to|fill|stroke|outline|accent|caret|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\\b/]',
          message:
            'No raw Tailwind palette colors — use design-system token/semantic classes (bg-primary, text-muted-foreground, bg-success, text-warning, …). Tokens: @axa/platform/tokens (css/theme.oklch.css) + globals.css.',
        },
      ],
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', '*.config.*', 'sentry.*.config.ts'],
  },
];
