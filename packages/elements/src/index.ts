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
 *
 * **Registration order**: children before their composite parent, so
 * `<an-radio>` upgrades before `<an-radio-group>` looks at its options. The
 * guard keeps a second import (or a hand-written `customElements.define`) from
 * throwing.
 */

import { AnButton } from './button/an-button';
import { AnInput } from './input/an-input';
import { AnCheckbox } from './checkbox/an-checkbox';
import { AnSwitch } from './switch/an-switch';
import { AnRadio } from './radio/an-radio';
import { AnRadioGroup } from './radio-group/an-radio-group';
import { AnTextarea } from './textarea/an-textarea';
import { AnSelect } from './select/an-select';
import { AnField } from './field/an-field';

export { AnElement } from './internal/base';
export type { Defaults, Primitive } from './internal/base';
export { AnButton } from './button/an-button';
export type { AnButtonSize, AnButtonType, AnButtonVariant } from './button/an-button';
export { AnInput } from './input/an-input';
export type { AnInputSize, AnInputType } from './input/an-input';
export { AnCheckbox } from './checkbox/an-checkbox';
export type { AnCheckboxChangeDetail } from './checkbox/an-checkbox';
export { AnSwitch } from './switch/an-switch';
export type { AnSwitchChangeDetail } from './switch/an-switch';
export { AnRadio } from './radio/an-radio';
export type { AnRadioEventDetail } from './radio/an-radio';
export { AnRadioGroup } from './radio-group/an-radio-group';
export type { AnRadioGroupEventDetail } from './radio-group/an-radio-group';
export { AnTextarea } from './textarea/an-textarea';
export type { AnTextareaResize } from './textarea/an-textarea';
export { AnSelect } from './select/an-select';
export type { AnSelectSize } from './select/an-select';
export { AnField } from './field/an-field';

declare global {
  interface HTMLElementTagNameMap {
    'an-button': AnButton;
    'an-input': AnInput;
    'an-checkbox': AnCheckbox;
    'an-switch': AnSwitch;
    'an-radio': AnRadio;
    'an-radio-group': AnRadioGroup;
    'an-textarea': AnTextarea;
    'an-select': AnSelect;
    'an-field': AnField;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('an-button')) {
  customElements.define('an-button', AnButton);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-input')) {
  customElements.define('an-input', AnInput);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-checkbox')) {
  customElements.define('an-checkbox', AnCheckbox);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-switch')) {
  customElements.define('an-switch', AnSwitch);
}

// Children first: `<an-radio-group>` reads its `<an-radio>` options on connect.
if (typeof customElements !== 'undefined' && !customElements.get('an-radio')) {
  customElements.define('an-radio', AnRadio);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-radio-group')) {
  customElements.define('an-radio-group', AnRadioGroup);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-textarea')) {
  customElements.define('an-textarea', AnTextarea);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-select')) {
  customElements.define('an-select', AnSelect);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-field')) {
  customElements.define('an-field', AnField);
}
