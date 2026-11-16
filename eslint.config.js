import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const BROWSER_GLOBALS = ['window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'navigator', 'self'];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'backups', 'reference'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { ...jsxA11y.flatConfigs.recommended, files: ['src/**/*.tsx'] },
  {
    // Keyboard users must be able to focus a scrollable region to scroll it (WCAG 2.1.1). We only allow
    // tabIndex on role="region" (the labelled scroll containers for tables); the rule stays on elsewhere.
    files: ['src/**/*.tsx'],
    rules: { 'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['tabpanel', 'region'], tags: [] }] },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // state.tsx genuinely co-locates the context object and its provider (consumers need both from one module).
    // Every other module keeps non-component exports in a sibling file (csv.ts, chartUtils.ts, severity.ts).
    files: ['src/state.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // ARCHITECTURE §8.4: these modules must stay pure (no DOM / browser globals).
    files: ['src/lib/{parse,analyze,classify,time}.ts'],
    rules: {
      'no-restricted-globals': ['error', ...BROWSER_GLOBALS.map((name) => ({ name, message: 'Pure module: no browser globals.' }))],
    },
  },
);
