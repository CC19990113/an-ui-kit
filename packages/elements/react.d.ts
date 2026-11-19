/**
 * React 19 JSX typings for `<an-button>`.
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
 * receives the native `CustomEvent<{ originalEvent: MouseEvent }>`.
 *
 * `<an-button>` renders a native `<button>` in its shadow root. It is styled
 * from the outside through the `part="base"` hook and the CSS custom
 * properties `--an-button-height`, `--an-button-radius` and
 * `--an-button-font-size`.
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
      }
    }
  }
}

export {};
