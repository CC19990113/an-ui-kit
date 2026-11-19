/**
 * Vue 3 template/TSX types for all 17 AN UI Kit custom elements. Include once:
 *
 *     import type {} from '@an-ui-kit/elements/vue';
 *
 * Keep `isCustomElement: tag => tag.startsWith('an-')` in the Vue compiler
 * configuration. These are type declarations, not Vue runtime wrappers.
 * GlobalComponents includes both `AnSelect` and `an-select`. Event props keep
 * both Vue mappings: `onAnSelectChange` and `onAn-select-change`, corresponding
 * to the template listener `@an-select-change`.
 */
import type { DefineComponent, HTMLAttributes } from 'vue';
import type {
  AnElementInputs,
  AnElementTagName,
  AnVueEventProps,
} from './dist/internal/framework-types.js';

export type AnVueElementProps<Tag extends AnElementTagName> =
  Omit<HTMLAttributes, keyof AnElementInputs[Tag]> &
  AnElementInputs[Tag] &
  AnVueEventProps<Tag> & {
    [attribute: `data-${string}`]: string | number | boolean | null | undefined;
  };

declare module 'vue' {
  interface GlobalComponents {
    AnButton: DefineComponent<AnVueElementProps<'an-button'>>;
    'an-button': DefineComponent<AnVueElementProps<'an-button'>>;
    AnCheckbox: DefineComponent<AnVueElementProps<'an-checkbox'>>;
    'an-checkbox': DefineComponent<AnVueElementProps<'an-checkbox'>>;
    AnCheckboxGroup: DefineComponent<AnVueElementProps<'an-checkbox-group'>>;
    'an-checkbox-group': DefineComponent<AnVueElementProps<'an-checkbox-group'>>;
    AnDate: DefineComponent<AnVueElementProps<'an-date'>>;
    'an-date': DefineComponent<AnVueElementProps<'an-date'>>;
    AnDateRange: DefineComponent<AnVueElementProps<'an-date-range'>>;
    'an-date-range': DefineComponent<AnVueElementProps<'an-date-range'>>;
    AnField: DefineComponent<AnVueElementProps<'an-field'>>;
    'an-field': DefineComponent<AnVueElementProps<'an-field'>>;
    AnForm: DefineComponent<AnVueElementProps<'an-form'>>;
    'an-form': DefineComponent<AnVueElementProps<'an-form'>>;
    AnInput: DefineComponent<AnVueElementProps<'an-input'>>;
    'an-input': DefineComponent<AnVueElementProps<'an-input'>>;
    AnNumber: DefineComponent<AnVueElementProps<'an-number'>>;
    'an-number': DefineComponent<AnVueElementProps<'an-number'>>;
    AnOption: DefineComponent<AnVueElementProps<'an-option'>>;
    'an-option': DefineComponent<AnVueElementProps<'an-option'>>;
    AnOptionGroup: DefineComponent<AnVueElementProps<'an-option-group'>>;
    'an-option-group': DefineComponent<AnVueElementProps<'an-option-group'>>;
    AnRadio: DefineComponent<AnVueElementProps<'an-radio'>>;
    'an-radio': DefineComponent<AnVueElementProps<'an-radio'>>;
    AnRadioGroup: DefineComponent<AnVueElementProps<'an-radio-group'>>;
    'an-radio-group': DefineComponent<AnVueElementProps<'an-radio-group'>>;
    AnSelect: DefineComponent<AnVueElementProps<'an-select'>>;
    'an-select': DefineComponent<AnVueElementProps<'an-select'>>;
    AnSwitch: DefineComponent<AnVueElementProps<'an-switch'>>;
    'an-switch': DefineComponent<AnVueElementProps<'an-switch'>>;
    AnTextarea: DefineComponent<AnVueElementProps<'an-textarea'>>;
    'an-textarea': DefineComponent<AnVueElementProps<'an-textarea'>>;
    AnUpload: DefineComponent<AnVueElementProps<'an-upload'>>;
    'an-upload': DefineComponent<AnVueElementProps<'an-upload'>>;
  }
}
