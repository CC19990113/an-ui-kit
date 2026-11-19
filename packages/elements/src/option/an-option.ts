import optionStyles from './an-option.css?inline';
import { AnElement } from '../internal/base';

/**
 * `<an-option>` — one option of an `<an-select>`.
 *
 * The element renders nothing: `<an-select>` reads the `value` / `label` /
 * `disabled` state and the text content of its light-DOM `<an-option>` children,
 * then draws the list in its own shadow root. Because the host is `display:none`
 * the markup stays authorable without JavaScript and without being painted
 * twice.
 *
 * @attr {string} value - Value submitted when this option is selected. Default: the trimmed text content.
 * @attr {boolean} disabled - Prevents the option from being selected. Default: false.
 * @attr {string} label - Accessible name. Default: the trimmed text content.
 * @slot - Option label, used when `label` and `value` are absent.
 */
export class AnOption extends AnElement {
  static override styles: string = optionStyles;

  /** The owning `<an-select>` submits the chosen value, never the option. */
  static override formAssociated = false;

  static override defaults = { disabled: false };

  declare disabled: boolean;

  /** Selected value; an attribute wins, otherwise the trimmed text content. */
  get value(): string {
    const attribute = this.getAttribute('value');
    return attribute === null ? (this.textContent ?? '').trim() : attribute;
  }

  set value(next: string) {
    this.setAttribute('value', String(next));
  }

  /** Accessible name; an empty `label` falls back to the trimmed text content. */
  get label(): string {
    const attribute = this.getAttribute('label');
    return attribute === null || attribute.trim() === ''
      ? (this.textContent ?? '').trim()
      : attribute;
  }

  set label(next: string) {
    if (String(next).trim() === '') this.removeAttribute('label');
    else this.setAttribute('label', String(next));
  }

  /** Options are data for `<an-select>`; they never paint their own markup. */
  protected override render(): string {
    return '';
  }
}
