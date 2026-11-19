/**
 * Vue 3 typings for `<an-button>`.
 *
 * This file is type-only: it imports no runtime value. It augments Vue's
 * `GlobalComponents` map, which Vue language tools (Volar / vue-tsc) use to
 * type-check `<an-button>` in templates — including the lowercase tag.
 *
 * Tell the Vue compiler that `an-*` tags are native custom elements, otherwise
 * it tries to resolve `<an-button>` as a component at runtime:
 *
 * ```ts
 * // main.ts
 * app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('an-');
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
 *           isCustomElement: (tag) => tag.startsWith('an-'),
 *         },
 *       },
 *     }),
 *   ],
 * });
 * ```
 *
 * Event props follow Vue's `on` + camelCase convention: the bubbling,
 * composed `an-button-click` event is typed as `onAnButtonClick` and written
 * in templates as `@an-button-click`.
 */

import type { DefineComponent } from 'vue';

/** Attributes / camelCase properties accepted by `<an-button>`. */
interface AnButtonProps {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  /** Native `an-button-click` handler; receives the element's `CustomEvent`. */
  onAnButtonClick?: (event: CustomEvent<{ originalEvent: MouseEvent }>) => void;
}

declare module 'vue' {
  interface GlobalComponents {
    AnButton: DefineComponent<AnButtonProps>;
  }
}
