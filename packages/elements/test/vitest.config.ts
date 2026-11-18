import { defineConfig } from 'vitest/config';

/**
 * `css: true` is required by Vitest 5: with the default `css: false` every CSS
 * import — including `?inline` / `?raw` — resolves to an empty string, so the
 * component would adopt an empty stylesheet and the style assertions would fail.
 */
export default defineConfig({
  root: new URL('..', import.meta.url).pathname,
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    css: true,
  },
});
