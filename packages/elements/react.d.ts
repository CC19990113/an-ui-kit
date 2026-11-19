/**
 * React 19 JSX typings for the AN UI Kit custom elements
 * (`an-button`, `an-input`, `an-textarea`, `an-select`, `an-checkbox`,
 * `an-radio`, `an-radio-group`, `an-switch`, `an-field`).
 *
 * This file is type-only: it imports no runtime value and emits nothing.
 * Include it once in a React app, e.g. in a `.d.ts`/`.ts` file that is part
 * of the program:
 *
 * ```ts
 * import type {} from '@an-ui-kit/elements/react';
 * ```
 *
 * React 19 listens for a custom element's events with `on` + the exact event
 * name (no camel-casing, no `SyntheticEvent` wrapper), so the
 * `an-button-click` event is the `'onan-button-click'` prop and the handler
 * receives the native `CustomEvent<{ originalEvent: MouseEvent }>`. The same
 * rule makes `<an-input>`'s `an-input` / `an-change` events the
 * `'onan-input'` / `'onan-change'` props, and `<an-checkbox>`'s
 * `an-checkbox-change` event the `'onan-checkbox-change'` prop — never
 * `onAnCheckboxChange` (which would listen for `AnCheckboxChange`).
 *
 * `<an-button>` renders a native `<button>` in its shadow root. It is styled
 * from the outside through the `part="base"` hook and the CSS custom
 * properties `--an-button-height`, `--an-button-radius` and
 * `--an-button-font-size`.
 *
 * `<an-input>` renders a native `<input>` in its shadow root, with the
 * `part="base"` / `part="input"` hooks. Its `value` attribute only seeds the
 * control: typing never writes the attribute back, so bind the `value`
 * property (or listen to `an-input`) to read changes.
 */

/** Attributes / camelCase properties accepted by `<an-button>`. */
type AnButtonAttributes = {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
};

/** `detail` payload of the bubbling, composed `an-button-click` event. */
type AnButtonClickDetail = {
  originalEvent: MouseEvent;
};

/** Attributes / camelCase properties accepted by `<an-input>`. */
type AnInputAttributes = {
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
};

/** `detail` payload of the bubbling, composed `an-input` / `an-change` events. */
type AnInputEventDetail = {
  value: string;
  originalEvent: InputEvent | Event;
};

/** Attributes / camelCase properties accepted by `<an-textarea>`. */
type AnTextareaAttributes = {
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
};

/** `detail` payload of the bubbling, composed `an-textarea-input` / `an-textarea-change` events. */
type AnTextareaEventDetail = {
  value: string;
  originalEvent: InputEvent | Event;
};

/** Attributes / camelCase properties accepted by `<an-select>`. */
type AnSelectAttributes = {
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
};

/** `detail` payload of the bubbling, composed `an-select-change` event. */
type AnSelectEventDetail = {
  value: string;
  originalEvent: Event;
};

/** Attributes / camelCase properties accepted by `<an-checkbox>`. */
type AnCheckboxAttributes = {
  /** Checked state; a user toggle writes this attribute back, so it is live state. */
  checked?: boolean;
  disabled?: boolean;
  required?: boolean;
  indeterminate?: boolean;
  /** Form field name: the key added to `FormData` while checked. */
  name?: string;
  /** Value submitted while checked. Default: `"on"`. */
  value?: string;
};

/** `detail` payload of the bubbling, composed `an-checkbox-change` event. */
type AnCheckboxChangeDetail = {
  checked: boolean;
  value: string;
  originalEvent: Event;
};

/** Attributes / camelCase properties accepted by `<an-switch>`. */
type AnSwitchAttributes = {
  /** Checked state; a user toggle writes this attribute back, so it is live state. */
  checked?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Form field name: the key added to `FormData` while on. */
  name?: string;
  /** Value submitted while on. Default: `"on"`. */
  value?: string;
};

/** `detail` payload of the bubbling, composed `an-switch-change` event. */
type AnSwitchChangeDetail = {
  checked: boolean;
  value: string;
  originalEvent: Event;
};

/** Attributes / camelCase properties accepted by `<an-radio>`. */
type AnRadioAttributes = {
  /** Submitted value of the option. */
  value?: string;
  /** Owned by the enclosing `<an-radio-group>`; writing it directly is not the API. */
  checked?: boolean;
  disabled?: boolean;
};

/** `detail` payload of `an-radio-select` / `an-radio-connect` on `<an-radio>`. */
type AnRadioSelectDetail = {
  value: string;
  originalEvent?: Event;
};

/** Attributes / camelCase properties accepted by `<an-radio-group>`. */
type AnRadioGroupAttributes = {
  /** Form field name: the key this group adds to `FormData`. */
  name?: string;
  /** Selected value; the attribute seeds it once, the property never writes it back. */
  value?: string;
  /** Visible label, also used to name the `radiogroup` for assistive technology. */
  label?: string;
  disabled?: boolean;
  required?: boolean;
};

/** `detail` payload of the bubbling, composed `an-radio-change` event. */
type AnRadioGroupChangeDetail = {
  value: string;
  originalEvent: Event;
};

/** Attributes / camelCase properties accepted by `<an-field>`. */
type AnFieldAttributes = {
  /** Visible label text; also mirrors onto the slotted control's accessible name. */
  label?: string;
  /** Secondary help text shown under the control. */
  hint?: string;
  /** Forces the error message and wins over the one captured from `invalid`. */
  error?: string;
  required?: boolean;
};

/**
 * Stand-in for projects that check this file without React's own types
 * (for example the package's standalone `tsc -p packages/elements`).
 * Inside the `React` namespace below, React's real `ReactNode` wins as soon
 * as `@types/react` is installed, so consumers get the strict type.
 */
type ReactNode = unknown;

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'an-button': AnButtonAttributes & {
          /** Default slot: the button label. */
          children?: ReactNode;
          'onan-button-click'?: (event: CustomEvent<AnButtonClickDetail>) => void;
        };
        'an-input': AnInputAttributes & {
          'onan-input'?: (event: CustomEvent<AnInputEventDetail>) => void;
          'onan-change'?: (event: CustomEvent<AnInputEventDetail>) => void;
        };
        'an-textarea': AnTextareaAttributes & {
          'onan-textarea-input'?: (event: CustomEvent<AnTextareaEventDetail>) => void;
          'onan-textarea-change'?: (event: CustomEvent<AnTextareaEventDetail>) => void;
        };
        'an-select': AnSelectAttributes & {
          /** `<option>` children are the options; the first `placeholder` option is added internally. */
          children?: ReactNode;
          'onan-select-change'?: (event: CustomEvent<AnSelectEventDetail>) => void;
        };
        'an-checkbox': AnCheckboxAttributes & {
          /** Default slot: the visible label text. */
          children?: ReactNode;
          'onan-checkbox-change'?: (event: CustomEvent<AnCheckboxChangeDetail>) => void;
        };
        'an-switch': AnSwitchAttributes & {
          /** Default slot: the visible label text. */
          children?: ReactNode;
          'onan-switch-change'?: (event: CustomEvent<AnSwitchChangeDetail>) => void;
        };
        'an-radio': AnRadioAttributes & {
          /** Default slot: the visible label text. */
          children?: ReactNode;
          'onan-radio-select'?: (event: CustomEvent<AnRadioSelectDetail>) => void;
          'onan-radio-connect'?: (event: CustomEvent<AnRadioSelectDetail>) => void;
        };
        'an-radio-group': AnRadioGroupAttributes & {
          /** `<an-radio>` children are the options. */
          children?: ReactNode;
          'onan-radio-change'?: (event: CustomEvent<AnRadioGroupChangeDetail>) => void;
        };
        'an-field': AnFieldAttributes & {
          /** Slotted form control(s) the label / hint / error describe. */
          children?: ReactNode;
        };
      }
    }
  }
}

export {};
