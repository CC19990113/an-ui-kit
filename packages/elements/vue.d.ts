/**
 * Vue 3 typings for `<an-button>` and `<an-input>`.
 *
 * This file is type-only: it imports no runtime value. It augments Vue's
 * `GlobalComponents` map, which Vue language tools (Volar / vue-tsc) use to
 * type-check `<an-button>` / `<an-input>` in templates — including the
 * lowercase tag.
 *
 * Tell the Vue compiler that `an-*` tags are native custom elements, otherwise
 * it tries to resolve `<an-button>` / `<an-input>` as a component at runtime:
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
 * in templates as `@an-button-click`; `<an-input>`'s `an-input` / `an-change`
 * events are `onAnInput` / `onAnChange`, written as `@an-input` / `@an-change`.
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

/** Attributes / camelCase properties accepted by `<an-input>`. */
interface AnInputProps {
  /** Initial value: the attribute seeds the control once, it is never written back. */
  value?: string;
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number';
  placeholder?: string;
  /** Visible `<label>`; when empty the element only forwards `aria-label` / `aria-labelledby`. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  /** Read-only submits its value but, like the native element, skips constraint validation. */
  readonly?: boolean;
  required?: boolean;
  invalid?: boolean;
  /** Form field name: the key this control adds to `FormData`. */
  name?: string;
  /** Native `an-input` handler; written in templates as `@an-input`. */
  onAnInput?: (event: CustomEvent<{ value: string; originalEvent: InputEvent | Event }>) => void;
  /** Native `an-change` handler; written in templates as `@an-change`. */
  onAnChange?: (event: CustomEvent<{ value: string; originalEvent: InputEvent | Event }>) => void;
}

declare module 'vue' {
  interface GlobalComponents {
    AnButton: DefineComponent<AnButtonProps>;
    AnInput: DefineComponent<AnInputProps>;
  }
}
