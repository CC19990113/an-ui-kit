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
 * `<an-option>` and `<an-option-group>` upgrade before `<an-select>` reads its
 * options, and `<an-radio>` / `<an-checkbox>` upgrade before their groups look
 * at them. All 17 elements are registered here. The guard keeps a second import
 * (or a hand-written `customElements.define`) from throwing.
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
import { AnOption } from './option/an-option';
import { AnOptionGroup } from './option-group/an-option-group';
import { AnUpload } from './upload/an-upload';
import { createXhrUploader } from './upload/xhr-uploader';
import { AnNumber } from './number/an-number';
import { AnDate } from './date/an-date';
import { AnDateRange } from './date/an-date-range';
import { AnCheckboxGroup } from './checkbox-group/an-checkbox-group';
import { AnForm } from './form/an-form';

export { AnElement } from './internal/base';
export type { ArrayDefaults, Defaults, Primitive } from './internal/base';
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
export type {
  AnSelectSize,
  AnSelectVirtual,
  AnSelectOption,
  AnSelectGroup,
  AnSelectLoadMoreDetail,
} from './select/an-select';
export { AnField } from './field/an-field';
export { AnOption } from './option/an-option';
export { AnOptionGroup } from './option-group/an-option-group';
export { AnUpload, createXhrUploader } from './upload/an-upload';
export type {
  AnUploader,
  AnUploadSize,
  AnUploadListType,
  AnUploadStatus,
  AnUploadRejectReason,
  AnUploadContext,
  AnUploadChangeDetail,
  AnUploadRejectDetail,
  AnUploadProgressDetail,
  AnUploadSuccessDetail,
  AnUploadErrorDetail,
  AnUploadAbortDetail,
  XhrUploaderOptions,
} from './upload/an-upload';
export { AnNumber } from './number/an-number';
export type { AnNumberSize, AnNumberChangeDetail } from './number/an-number';
export { AnDate } from './date/an-date';
export type { AnDateSize, AnDateChangeDetail } from './date/an-date';
export { AnDateRange } from './date/an-date-range';
export type { AnDateRangeChangeDetail, AnDateRangePreset } from './date/an-date-range';
export { AnCheckboxGroup } from './checkbox-group/an-checkbox-group';
export type { AnCheckboxGroupEventDetail } from './checkbox-group/an-checkbox-group';
export { AnForm } from './form/an-form';
export type {
  AnFormFieldError,
  AnFormSubmitDetail,
  AnFormInvalidDetail,
  AnFormRule,
  AnFormRules,
} from './form/an-form';
export type {
  AnElementInputs,
  AnElementInstances,
  AnElementEventDetails,
  AnElementTagName,
  AnButtonClickDetail,
  AnTextInputDetail,
  AnInputClearDetail,
  AnSelectChangeDetail,
  AnSearchDetail,
  AnRadioConnectDetail,
} from './internal/framework-types';

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
    'an-option': AnOption;
    'an-option-group': AnOptionGroup;
    'an-upload': AnUpload;
    'an-number': AnNumber;
    'an-date': AnDate;
    'an-date-range': AnDateRange;
    'an-checkbox-group': AnCheckboxGroup;
    'an-form': AnForm;
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

// Children before composite parent: `<an-checkbox>` above is registered first,
// and `<an-checkbox-group>` collects its children on connect.
if (typeof customElements !== 'undefined' && !customElements.get('an-checkbox-group')) {
  customElements.define('an-checkbox-group', AnCheckboxGroup);
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

// Children before composite parent: `<an-option>` must upgrade before
// `<an-select>` reads its option children on connect.
if (typeof customElements !== 'undefined' && !customElements.get('an-option')) {
  customElements.define('an-option', AnOption);
}

// Children before composite parent: `<an-option-group>` must upgrade before
// `<an-select>` collects its groups, same level as `<an-option>` above.
if (typeof customElements !== 'undefined' && !customElements.get('an-option-group')) {
  customElements.define('an-option-group', AnOptionGroup);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-select')) {
  customElements.define('an-select', AnSelect);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-field')) {
  customElements.define('an-field', AnField);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-upload')) {
  customElements.define('an-upload', AnUpload);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-number')) {
  customElements.define('an-number', AnNumber);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-date')) {
  customElements.define('an-date', AnDate);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-date-range')) {
  customElements.define('an-date-range', AnDateRange);
}

if (typeof customElements !== 'undefined' && !customElements.get('an-form')) {
  customElements.define('an-form', AnForm);
}
