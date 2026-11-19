/**
 * `@an-ui-kit/elements` — framework-agnostic web components with zero runtime deps.
 *
 * **Single entry**: importing this module registers every element with
 * `customElements`, and this is the only JS entry the package publishes. There
 * are no per-component subpaths — a page that needs a smaller bundle runs the
 * config-driven trim build instead (`an-ui-kit.config.json` +
 * `pnpm build:custom`), which emits one self-contained bundle containing only
 * the selected elements. The selected elements behave exactly like they do
 * here, including their registration.
 */

import { AnButton } from './button/an-button';
import { AnInput } from './input/an-input';

export { AnElement } from './internal/base';
export type { Defaults, Primitive } from './internal/base';
export { AnButton } from './button/an-button';
export type { AnButtonSize, AnButtonType, AnButtonVariant } from './button/an-button';
export { AnInput } from './input/an-input';
export type { AnInputSize, AnInputType } from './input/an-input';

declare global {
  interface HTMLElementTagNameMap {
    'an-button': AnButton;
    'an-input': AnInput;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('an-button')) {
  customElements.define('an-button', AnButton);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-input')) {
  customElements.define('an-input', AnInput);
}
