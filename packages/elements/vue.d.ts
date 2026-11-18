/**
 * Vue 3 typings for `<x-button>`.
 *
 * This file is type-only: it imports no runtime value. It augments Vue's
 * `GlobalComponents` map, which Vue language tools (Volar / vue-tsc) use to
 * type-check `<x-button>` in templates — including the lowercase tag.
 *
 * Tell the Vue compiler that `x-*` tags are native custom elements, otherwise
 * it tries to resolve `<x-button>` as a component at runtime:
 *
 * ```ts
 * // main.ts
 * app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('x-');
 * ```
 *
 * With `@vitejs/plugin-vue` the same predicate belongs to the plugin:
 *
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import vue from '@vitejs/plugin-vue';
 *
 * export default defineConfig({
 *   plugins: [
 *     vue({
 *       template: {
 *         compilerOptions: {
 *           isCustomElement: (tag) => tag.startsWith('x-'),
 *         },
 *       },
 *     }),
 *   ],
 * });
 * ```
 *
 * Event props follow Vue's `on` + camelCase convention: the bubbling,
 * composed `x-button-click` event is typed as `onXButtonClick` and written
 * in templates as `@x-button-click`.
 */

import type { DefineComponent } from 'vue';

/** Attributes / camelCase properties accepted by `<x-button>`. */
interface XButtonProps {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  /** Native `x-button-click` handler; receives the element's `CustomEvent`. */
  onXButtonClick?: (event: CustomEvent<{ originalEvent: MouseEvent }>) => void;
}

declare module 'vue' {
  interface GlobalComponents {
    XButton: DefineComponent<XButtonProps>;
  }
}
