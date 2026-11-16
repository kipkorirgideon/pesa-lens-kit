import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const BROWSER_GLOBALS = ['window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'navigator', 'self'];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'backups', 'reference'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
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
    // These files intentionally co-export helpers/context with components; splitting them is out of scope for TASK-1.
    files: ['src/state.tsx', 'src/components/{DataTable,chart,ui}.tsx'],
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
