/**
 * `@x/elements` — framework-agnostic web components with zero runtime deps.
 *
 * Importing this module registers every element with `customElements`; importing
 * a single component module (e.g. `@x/elements/button`) does the same for that
 * element only.
 */

import { XButton } from './button/x-button';

export { XElement } from './internal/base';
export type { Defaults, Primitive } from './internal/base';
export { XButton } from './button/x-button';
export type { XButtonSize, XButtonType, XButtonVariant } from './button/x-button';

declare global {
  interface HTMLElementTagNameMap {
    'x-button': XButton;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('x-button')) {
  customElements.define('x-button', XButton);
}
