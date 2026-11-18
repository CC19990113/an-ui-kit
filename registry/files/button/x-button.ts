import buttonStyles from './x-button.css?inline';
import { XElement } from '../internal/base';

/** Visual intents of `<x-button>`. */
export type XButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';
/** Control sizes of `<x-button>`. */
export type XButtonSize = 'sm' | 'md' | 'lg';
/** Native button types forwarded by `<x-button>`. */
export type XButtonType = 'button' | 'submit' | 'reset';

const VARIANTS: readonly XButtonVariant[] = ['default', 'primary', 'danger', 'ghost'];
const SIZES: readonly XButtonSize[] = ['sm', 'md', 'lg'];
const TYPES: readonly XButtonType[] = ['button', 'submit', 'reset'];

function oneOf<T extends string>(allowed: readonly T[], value: string, fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * `<x-button>` — an action element backed by a real native `<button>` inside
 * the shadow root, so focus, keyboard activation and accessibility come from
 * the platform. Note: `type="submit"` does not submit an outer form (Shadow
 * DOM limitation).
 *
 * The default slot holds the label. `disabled` and `loading` both block the
 * native button and swallow clicks; while loading the internal button also
 * carries `aria-busy="true"`.
 *
 * @attr {('default'|'primary'|'danger'|'ghost')} variant - Visual intent. Default: "default".
 * @attr {('sm'|'md'|'lg')} size - Control size. Default: "md".
 * @attr {boolean} disabled - Disables the native button and blocks `x-button-click`.
 * @attr {boolean} loading - Marks the button busy with `aria-busy="true"` and blocks clicks.
 * @attr {('button'|'submit'|'reset')} type - Native button type. Default: "button".
 * @slot - Default slot: the button label (text, icon, or both).
 * @cssprop --x-button-height - Control height; defaults to 2.25rem (2rem sm, 2.75rem lg).
 * @cssprop --x-button-radius - Corner radius; defaults to 0.5rem (0.375rem sm, 0.625rem lg).
 * @cssprop --x-button-font-size - Label font size; defaults to 0.875rem (0.8125rem sm, 1rem lg).
 * @csspart base - The internal native `<button>` element.
 * @fires x-button-click - Fired when the user activates the button; `detail.originalEvent` is the native MouseEvent.
 */
export class XButton extends XElement {
  static override styles: string = buttonStyles;

  static override defaults = {
    variant: 'default',
    size: 'md',
    disabled: false,
    loading: false,
    type: 'button',
  };

  declare variant: XButtonVariant;
  declare size: XButtonSize;
  declare disabled: boolean;
  declare loading: boolean;
  declare type: XButtonType;

  constructor() {
    super();
    // Delegation on the shadow root survives the innerHTML re-render.
    this.shadowRoot!.addEventListener('click', this.#onClick);
  }

  protected render(): string {
    const type = oneOf(TYPES, this.type, 'button');
    const blocked = this.disabled || this.loading ? ' disabled' : '';
    const busy = this.loading ? ' aria-busy="true"' : '';
    return `<button class="base" part="base" type="${type}"${blocked}${busy}><slot></slot></button>`;
  }

  protected override afterRender(): void {
    const button = this.#button;
    if (!button) return;
    button.disabled = this.disabled || this.loading;
    if (this.loading) button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
  }

  #onClick = (event: Event): void => {
    if (this.disabled || this.loading) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.emit('x-button-click', { originalEvent: event as MouseEvent });
  };

  get #button(): HTMLButtonElement | null {
    return this.shadowRoot?.querySelector('button') ?? null;
  }
}

export { VARIANTS, SIZES, TYPES };
