/**
 * `@an-ui-kit/elements` — framework-agnostic web components with zero runtime deps.
 *
 * Importing this module registers every element with `customElements`; importing
 * a single component module (e.g. `@an-ui-kit/elements/button`) does the same for that
 * element only.
 */

import { AnButton } from './button/an-button';

export { AnElement } from './internal/base';
export type { Defaults, Primitive } from './internal/base';
export { AnButton } from './button/an-button';
export type { AnButtonSize, AnButtonType, AnButtonVariant } from './button/an-button';

declare global {
  interface HTMLElementTagNameMap {
    'an-button': AnButton;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('an-button')) {
  customElements.define('an-button', AnButton);
}
