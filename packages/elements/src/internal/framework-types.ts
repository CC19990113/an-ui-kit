/**
 * Type-only input and event contracts shared by the React and Vue adapters.
 * These imports never register elements. Keep this file in src so declaration
 * builds publish it under dist/internal alongside the element declarations.
 */
import type { AnButton } from '../button/an-button';
import type { AnCheckbox, AnCheckboxChangeDetail } from '../checkbox/an-checkbox';
import type { AnCheckboxGroup, AnCheckboxGroupEventDetail } from '../checkbox-group/an-checkbox-group';
import type { AnDate, AnDateChangeDetail, AnDateSize } from '../date/an-date';
import type { AnDateRange, AnDateRangeChangeDetail, AnDateRangePreset } from '../date/an-date-range';
import type { AnField } from '../field/an-field';
import type { AnForm, AnFormInvalidDetail, AnFormSubmitDetail } from '../form/an-form';
import type { AnInput } from '../input/an-input';
import type { AnNumber, AnNumberChangeDetail } from '../number/an-number';
import type { AnOption } from '../option/an-option';
import type { AnOptionGroup } from '../option-group/an-option-group';
import type { AnRadio, AnRadioEventDetail } from '../radio/an-radio';
import type { AnRadioGroup, AnRadioGroupEventDetail } from '../radio-group/an-radio-group';
import type { AnSelect, AnSelectLoadMoreDetail, AnSelectOption } from '../select/an-select';
import type { AnSwitch, AnSwitchChangeDetail } from '../switch/an-switch';
import type { AnTextarea } from '../textarea/an-textarea';
import type {
  AnUpload, AnUploadAbortDetail, AnUploadChangeDetail, AnUploadErrorDetail,
  AnUploadProgressDetail, AnUploadRejectDetail, AnUploadSuccessDetail,
} from '../upload/an-upload';

/** String attributes may carry numbers; camelCase properties accept numbers. */
type NumericInput = number | string;
type OptionalInputs<T> = { [K in keyof T]?: T[K] };

/** The actual attribute spelling, not the native JSX maxLength/readOnly aliases. */
type KebabCase<S extends string> = S extends `${infer Head}${infer Tail}`
  ? Head extends Lowercase<Head>
    ? `${Head}${KebabCase<Tail>}`
    : `-${Lowercase<Head>}${KebabCase<Tail>}`
  : S;

/** Accept both attribute kebab-case and the component's camelCase property. */
type Inputs<T> = OptionalInputs<T> & {
  [K in keyof T as K extends string ? KebabCase<K> : never]?: T[K];
};

export interface AnElementInstances {
  'an-button': AnButton;
  'an-checkbox': AnCheckbox;
  'an-checkbox-group': AnCheckboxGroup;
  'an-date': AnDate;
  'an-date-range': AnDateRange;
  'an-field': AnField;
  'an-form': AnForm;
  'an-input': AnInput;
  'an-number': AnNumber;
  'an-option': AnOption;
  'an-option-group': AnOptionGroup;
  'an-radio': AnRadio;
  'an-radio-group': AnRadioGroup;
  'an-select': AnSelect;
  'an-switch': AnSwitch;
  'an-textarea': AnTextarea;
  'an-upload': AnUpload;
}

/** Writable public inputs only: methods and read-only snapshots belong on refs. */
export interface AnElementInputs {
  'an-button': Inputs<Pick<AnButton, 'variant' | 'size' | 'disabled' | 'loading' | 'type'>>;
  'an-checkbox': Inputs<Pick<AnCheckbox, 'checked' | 'disabled' | 'required' | 'indeterminate' | 'name' | 'value'>>;
  'an-checkbox-group': Inputs<
    Pick<AnCheckboxGroup, 'name' | 'label' | 'disabled' | 'required' | 'orientation' | 'selectAll'> &
    { value: string[] | string; min: NumericInput; max: NumericInput }
  >;
  'an-date': Inputs<
    Pick<AnDate, 'value' | 'min' | 'max' | 'open' | 'inline' | 'disabled' | 'readonly' | 'required' | 'placeholder' | 'name' | 'format'> &
    { size: AnDateSize; firstDay: 0 | 1 | '0' | '1' }
  >;
  'an-date-range': Inputs<
    Pick<AnDateRange, 'start' | 'end' | 'min' | 'max' | 'open' | 'inline' | 'disabled' | 'required' | 'placeholder' | 'name' | 'endName'> &
    { size: AnDateSize; firstDay: 0 | 1 | '0' | '1'; presets: AnDateRangePreset[] | string }
  >;
  'an-field': Inputs<Pick<AnField, 'label' | 'hint' | 'error' | 'required'>>;
  'an-form': Inputs<Pick<AnForm, 'novalidate' | 'loading' | 'showErrorSummary' | 'rules'>>;
  'an-input': Inputs<
    Pick<AnInput, 'value' | 'type' | 'placeholder' | 'label' | 'size' | 'disabled' | 'readonly' | 'required' | 'invalid' | 'name' | 'clearable' | 'showCount' | 'prefix' | 'suffix' | 'autocomplete' | 'inputmode'> &
    // React assigns this inherited boolean property; the string "false" becomes true.
    { maxlength: NumericInput; spellcheck: boolean }
  >;
  'an-number': Inputs<
    Pick<AnNumber, 'disabled' | 'readonly' | 'required' | 'placeholder' | 'name' | 'size' | 'stepper' | 'groupSeparator' | 'unit'> &
    { value: number | string | null; min: NumericInput; max: NumericInput; step: NumericInput; precision: NumericInput }
  >;
  'an-option': Inputs<Pick<AnOption, 'value' | 'label' | 'disabled'>>;
  'an-option-group': Inputs<Pick<AnOptionGroup, 'label' | 'disabled'>>;
  'an-radio': Inputs<Pick<AnRadio, 'value' | 'checked' | 'disabled'>>;
  'an-radio-group': Inputs<
    Pick<AnRadioGroup, 'name' | 'label' | 'disabled' | 'required'> & { value: string | null }
  >;
  'an-select': Inputs<
    Pick<AnSelect, 'value' | 'label' | 'placeholder' | 'size' | 'name' | 'disabled' | 'required' | 'invalid' | 'multiple' | 'searchable' | 'loading' | 'virtual' | 'open'> &
    { values: string[] | string; maxTags: NumericInput; loadMoreThreshold: NumericInput }
  >;
  'an-switch': Inputs<Pick<AnSwitch, 'checked' | 'disabled' | 'required' | 'name' | 'value'>>;
  'an-textarea': Inputs<
    Pick<AnTextarea, 'value' | 'placeholder' | 'label' | 'autoSize' | 'showCount' | 'resize' | 'disabled' | 'readonly' | 'required' | 'invalid' | 'name' | 'autocomplete'> &
    { rows: NumericInput; maxlength: NumericInput; minRows: NumericInput; maxRows: NumericInput }
  >;
  'an-upload': Omit<Inputs<
    Pick<AnUpload, 'name' | 'accept' | 'multiple' | 'disabled' | 'required' | 'action' | 'method' | 'fieldName' | 'size' | 'listType' | 'sortable' | 'headers' | 'uploader'> &
    { maxFiles: NumericInput; maxSize: NumericInput; concurrency: number; autoUpload: boolean }
  >, 'auto-upload'> & { 'auto-upload'?: boolean | 'true' | 'false' };
}

/** Public inline payloads not exported by a component source module. */
export interface AnButtonClickDetail { originalEvent: MouseEvent }
export interface AnTextInputDetail { value: string; originalEvent: InputEvent | Event }
export interface AnInputClearDetail { value: '' }
export interface AnSelectChangeDetail {
  value: string;
  values: string[];
  option: AnSelectOption | null;
  originalEvent: Event | null;
}
export interface AnSearchDetail { query: string }
export interface AnRadioConnectDetail { value: string }
type EmptyDetail = null | undefined;
type DatePanelDetail = Record<string, never>;

/** Exact dispatched names and native CustomEvent payloads, without framework wrappers. */
export interface AnElementEventDetails {
  'an-button': { 'an-button-click': AnButtonClickDetail };
  'an-checkbox': { 'an-checkbox-change': AnCheckboxChangeDetail };
  'an-checkbox-group': { 'an-checkbox-group-change': AnCheckboxGroupEventDetail };
  'an-date': {
    'an-date-change': AnDateChangeDetail;
    'an-date-open': DatePanelDetail;
    'an-date-close': DatePanelDetail;
  };
  'an-date-range': {
    'an-date-range-change': AnDateRangeChangeDetail;
    'an-date-range-open': DatePanelDetail;
    'an-date-range-close': DatePanelDetail;
  };
  'an-field': Record<never, never>;
  'an-form': {
    'an-form-submit': AnFormSubmitDetail;
    'an-form-invalid': AnFormInvalidDetail;
    'an-form-reset': EmptyDetail;
  };
  'an-input': { 'an-input': AnTextInputDetail; 'an-change': AnTextInputDetail; 'an-input-clear': AnInputClearDetail };
  'an-number': { 'an-number-change': AnNumberChangeDetail };
  'an-option': Record<never, never>;
  'an-option-group': Record<never, never>;
  'an-radio': { 'an-radio-connect': AnRadioConnectDetail; 'an-radio-select': AnRadioEventDetail };
  'an-radio-group': { 'an-radio-change': AnRadioGroupEventDetail };
  'an-select': {
    'an-select-change': AnSelectChangeDetail;
    'an-select-open': EmptyDetail;
    'an-select-close': EmptyDetail;
    'an-search': AnSearchDetail;
    'an-load-more': AnSelectLoadMoreDetail;
  };
  'an-switch': { 'an-switch-change': AnSwitchChangeDetail };
  'an-textarea': { 'an-textarea-input': AnTextInputDetail; 'an-textarea-change': AnTextInputDetail };
  'an-upload': {
    'an-upload-change': AnUploadChangeDetail;
    'an-upload-reject': AnUploadRejectDetail;
    'an-upload-progress': AnUploadProgressDetail;
    'an-upload-success': AnUploadSuccessDetail;
    'an-upload-error': AnUploadErrorDetail;
    'an-upload-abort': AnUploadAbortDetail;
  };
}

export type AnElementTagName = keyof AnElementInputs;

export type AnReactEventProps<Tag extends AnElementTagName> = {
  [E in keyof AnElementEventDetails[Tag] as E extends string ? `on${E}` : never]?:
    (event: CustomEvent<AnElementEventDetails[Tag][E]>) => void;
} & {
  [E in keyof AnElementEventDetails[Tag] as E extends string ? `on${E}Capture` : never]?:
    (event: CustomEvent<AnElementEventDetails[Tag][E]>) => void;
};

type PascalCase<S extends string> = S extends `${infer Head}-${infer Tail}`
  ? `${Capitalize<Head>}${PascalCase<Tail>}`
  : Capitalize<S>;

/** Vue accepts both camelized `onAnSelectChange` and `onAn-select-change`. */
export type AnVueEventProps<Tag extends AnElementTagName> = {
  [E in keyof AnElementEventDetails[Tag] as E extends string ? `on${PascalCase<E>}` : never]?:
    (event: CustomEvent<AnElementEventDetails[Tag][E]>) => void;
} & {
  [E in keyof AnElementEventDetails[Tag] as E extends string ? `on${Capitalize<E>}` : never]?:
    (event: CustomEvent<AnElementEventDetails[Tag][E]>) => void;
};
