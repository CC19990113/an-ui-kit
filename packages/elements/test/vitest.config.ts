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
    coverage: {
      // Match the Vitest major: @vitest/coverage-v8 is pinned to 5.1.1.
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      // `src/css.d.ts` is the ambient `*.css` module declaration and
      // `src/index.ts` only wires up registrations — neither has runtime code.
      exclude: ['src/**/*.d.ts', 'src/index.ts'],
      // Measured on 2026-11-19: 90.37% stmts / 80.96% branch / 95.83% funcs /
      // 95.67% lines. Each gate sits ~5 points below the measurement so a
      // refactor does not trip it, while a real coverage drop fails CI.
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 88,
        branches: 78,
      },
    },
  },
});
