/**
 * Vue 3 typings for the AN UI Kit custom elements (`an-button`, `an-input`,
 * `an-textarea`, `an-select`, `an-checkbox`, `an-radio`, `an-radio-group`,
 * `an-switch`, `an-field`).
 *
 * This file is type-only: it imports no runtime value. It augments Vue's
 * `GlobalComponents` map, which Vue language tools (Volar / vue-tsc) use to
 * type-check the `an-*` tags in templates — including the lowercase tag.
 *
 * Tell the Vue compiler that `an-*` tags are native custom elements, otherwise
 * it tries to resolve them as components at runtime:
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
 * The same mapping gives `<an-checkbox>`'s `an-checkbox-change` the prop
 * `onAnCheckboxChange`, written in templates as `@an-checkbox-change`.
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

/** Attributes / camelCase properties accepted by `<an-textarea>`. */
interface AnTextareaProps {
  /** Initial value: seeds the control once; typing never writes the attribute back. */
  value?: string;
  placeholder?: string;
  /** Visible `<label>`; when empty the element only forwards `aria-label` / `aria-labelledby`. */
  label?: string;
  rows?: number;
  maxlength?: number;
  resize?: 'none' | 'vertical' | 'both';
  disabled?: boolean;
  /** Read-only submits its value but, like the native element, skips constraint validation. */
  readonly?: boolean;
  required?: boolean;
  invalid?: boolean;
  /** Form field name: the key this control adds to `FormData`. */
  name?: string;
  /** Native `an-textarea-input` handler; written in templates as `@an-textarea-input`. */
  onAnTextareaInput?: (
    event: CustomEvent<{ value: string; originalEvent: InputEvent | Event }>,
  ) => void;
  /** Native `an-textarea-change` handler; written in templates as `@an-textarea-change`. */
  onAnTextareaChange?: (
    event: CustomEvent<{ value: string; originalEvent: InputEvent | Event }>,
  ) => void;
}

/** Attributes / camelCase properties accepted by `<an-select>`. */
interface AnSelectProps {
  /** Initial value: seeds the control once; the attribute is never written back. */
  value?: string;
  label?: string;
  /** Shown as the empty, disabled first option. */
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  /** Form field name: the key this control adds to `FormData` when a value is selected. */
  name?: string;
  /** Native `an-select-change` handler; written in templates as `@an-select-change`. */
  onAnSelectChange?: (event: CustomEvent<{ value: string; originalEvent: Event }>) => void;
}

/** Attributes / camelCase properties accepted by `<an-checkbox>`. */
interface AnCheckboxProps {
  /** Checked state; a user toggle writes this attribute back, so it is live state. */
  checked?: boolean;
  disabled?: boolean;
  required?: boolean;
  indeterminate?: boolean;
  /** Form field name: the key added to `FormData` while checked. */
  name?: string;
  /** Value submitted while checked. Default: `"on"`. */
  value?: string;
  /** Native `an-checkbox-change` handler; written in templates as `@an-checkbox-change`. */
  onAnCheckboxChange?: (
    event: CustomEvent<{ checked: boolean; value: string; originalEvent: Event }>,
  ) => void;
}

/** Attributes / camelCase properties accepted by `<an-switch>`. */
interface AnSwitchProps {
  /** Checked state; a user toggle writes this attribute back, so it is live state. */
  checked?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Form field name: the key added to `FormData` while on. */
  name?: string;
  /** Value submitted while on. Default: `"on"`. */
  value?: string;
  /** Native `an-switch-change` handler; written in templates as `@an-switch-change`. */
  onAnSwitchChange?: (
    event: CustomEvent<{ checked: boolean; value: string; originalEvent: Event }>,
  ) => void;
}

/** Attributes / camelCase properties accepted by `<an-radio>`. */
interface AnRadioProps {
  /** Submitted value of the option. */
  value?: string;
  /** Owned by the enclosing `<an-radio-group>`; writing it directly is not the API. */
  checked?: boolean;
  disabled?: boolean;
  /** Native `an-radio-select` handler; written in templates as `@an-radio-select`. */
  onAnRadioSelect?: (event: CustomEvent<{ value: string; originalEvent?: Event }>) => void;
  /** Native `an-radio-connect` handler; written in templates as `@an-radio-connect`. */
  onAnRadioConnect?: (event: CustomEvent<{ value: string; originalEvent?: Event }>) => void;
}

/** Attributes / camelCase properties accepted by `<an-radio-group>`. */
interface AnRadioGroupProps {
  /** Form field name: the key this group adds to `FormData`. */
  name?: string;
  /** Selected value; the attribute seeds it once, the property never writes it back. */
  value?: string;
  /** Visible label, also used to name the `radiogroup` for assistive technology. */
  label?: string;
  disabled?: boolean;
  required?: boolean;
  /** Native `an-radio-change` handler; written in templates as `@an-radio-change`. */
  onAnRadioChange?: (event: CustomEvent<{ value: string; originalEvent: Event }>) => void;
}

/** Attributes / camelCase properties accepted by `<an-field>`. */
interface AnFieldProps {
  /** Visible label text; also mirrors onto the slotted control's accessible name. */
  label?: string;
  /** Secondary help text shown under the control. */
  hint?: string;
  /** Forces the error message and wins over the one captured from `invalid`. */
  error?: string;
  required?: boolean;
}

declare module 'vue' {
  interface GlobalComponents {
    AnButton: DefineComponent<AnButtonProps>;
    AnInput: DefineComponent<AnInputProps>;
    AnTextarea: DefineComponent<AnTextareaProps>;
    AnSelect: DefineComponent<AnSelectProps>;
    AnCheckbox: DefineComponent<AnCheckboxProps>;
    AnSwitch: DefineComponent<AnSwitchProps>;
    AnRadio: DefineComponent<AnRadioProps>;
    AnRadioGroup: DefineComponent<AnRadioGroupProps>;
    AnField: DefineComponent<AnFieldProps>;
  }
}
