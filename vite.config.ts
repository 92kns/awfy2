/// <reference types="vitest/config" />

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative assets work both at /awfy-reimagined/ on GitHub Pages and behind the
  // /gh/awfy-reimagined/ perf-labs proxy.
  base: './',
  plugins: [svelte()],
  test: {
    exclude: ['node_modules/**', 'tests/e2e/**'],
    coverage: {
      include: ['src/domain/**/*.ts', 'src/treeherder/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
