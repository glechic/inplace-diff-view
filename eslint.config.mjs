import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      obsidianmd,
    },
    rules: {
      ...obsidianmd.configs.recommended.rules,
      // Underscore-prefixed params signal intentionally unused API arguments.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    ignores: ['main.js', 'node_modules/', 'esbuild.config.mjs', 'version-bump.mjs'],
  },
);