/**
 * Stylesheet imports resolve to the raw CSS text, not to a side effect:
 * esbuild inlines them with `--loader:.css=text`, Vite resolves `?inline` to the
 * stylesheet text, and Vitest returns the content through `test.css: true`.
 */

declare module '*.css?inline' {
  const css: string;
  export default css;
}

declare module '*.css' {
  const css: string;
  export default css;
}
