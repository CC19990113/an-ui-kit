/**
 * React 19 JSX types for all 17 AN UI Kit elements. Include once:
 *
 *     import type {} from '@an-ui-kit/elements/react';
 *
 * React attaches `on` + the exact custom event name. For example,
 * `onan-select-change` receives a native CustomEvent; `onAnSelectChange` does
 * not listen to `an-select-change`. Both kebab-case attributes and camelCase
 * element properties are typed. There is no runtime import or wrapper.
 */
import type {
  AnElementInputs,
  AnElementInstances,
  AnElementTagName,
  AnReactEventProps,
} from './dist/internal/framework-types.js';

/** Standard HTML/ARIA props plus the component's own writable inputs. */
export type AnReactElementProps<Tag extends AnElementTagName> =
  Omit<React.HTMLAttributes<AnElementInstances[Tag]>, keyof AnElementInputs[Tag]> &
  React.RefAttributes<AnElementInstances[Tag]> &
  AnElementInputs[Tag] &
  AnReactEventProps<Tag> & {
    /** React passes `class` verbatim on custom elements; `className` also stays supported. */
    class?: string;
    [attribute: `data-${string}`]: string | number | boolean | null | undefined;
  };

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'an-button': AnReactElementProps<'an-button'>;
        'an-checkbox': AnReactElementProps<'an-checkbox'>;
        'an-checkbox-group': AnReactElementProps<'an-checkbox-group'>;
        'an-date': AnReactElementProps<'an-date'>;
        'an-date-range': AnReactElementProps<'an-date-range'>;
        'an-field': AnReactElementProps<'an-field'>;
        'an-form': AnReactElementProps<'an-form'>;
        'an-input': AnReactElementProps<'an-input'>;
        'an-number': AnReactElementProps<'an-number'>;
        'an-option': AnReactElementProps<'an-option'>;
        'an-option-group': AnReactElementProps<'an-option-group'>;
        'an-radio': AnReactElementProps<'an-radio'>;
        'an-radio-group': AnReactElementProps<'an-radio-group'>;
        'an-select': AnReactElementProps<'an-select'>;
        'an-switch': AnReactElementProps<'an-switch'>;
        'an-textarea': AnReactElementProps<'an-textarea'>;
        'an-upload': AnReactElementProps<'an-upload'>;
      }
    }
  }
}
