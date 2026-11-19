import buttonStyles from './an-button.css?inline';
import { AnElement } from '../internal/base';

/** Visual intents of `<an-button>`. */
export type AnButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';
/** Control sizes of `<an-button>`. */
export type AnButtonSize = 'sm' | 'md' | 'lg';
/** Native button types forwarded by `<an-button>`. */
export type AnButtonType = 'button' | 'submit' | 'reset';

const VARIANTS: readonly AnButtonVariant[] = ['default', 'primary', 'danger', 'ghost'];
const SIZES: readonly AnButtonSize[] = ['sm', 'md', 'lg'];
const TYPES: readonly AnButtonType[] = ['button', 'submit', 'reset'];

function oneOf<T extends string>(allowed: readonly T[], value: string, fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * `<an-button>` — an action element backed by a real native `<button>` inside
 * the shadow root, so focus, keyboard activation and accessibility come from
 * the platform.
 *
 * The host is a form-associated custom element. The inner native button lives
 * across a shadow boundary and therefore cannot submit the outer form itself,
 * so the host performs the action through `ElementInternals.form`:
 * `type="submit"` calls `form.requestSubmit()` (constraint validation still
 * runs; `form.submit()` is deliberately not used) and `type="reset"` calls
 * `form.reset()`.
 *
 * The default slot holds the label. `disabled` and `loading` both block the
 * native button and swallow clicks; while loading the internal button also
 * carries `aria-busy="true"`.
 *
 * @attr {('default'|'primary'|'danger'|'ghost')} variant - Visual intent. Default: "default".
 * @attr {('sm'|'md'|'lg')} size - Control size. Default: "md".
 * @attr {boolean} disabled - Disables the native button and blocks `an-button-click`/form submission.
 * @attr {boolean} loading - Marks the button busy with `aria-busy="true"` and blocks clicks.
 * @attr {('button'|'submit'|'reset')} type - "submit" submits the owning form via `requestSubmit()`; "reset" resets it. Default: "button".
 * @slot - Default slot: the button label (text, icon, or both).
 * @cssprop --an-button-height - Control height; defaults to 2.25rem (2rem sm, 2.75rem lg).
 * @cssprop --an-button-radius - Corner radius; defaults to 0.5rem (0.375rem sm, 0.625rem lg).
 * @cssprop --an-button-font-size - Label font size; defaults to 0.875rem (0.8125rem sm, 1rem lg).
 * @csspart base - The internal native `<button>` element.
 * @fires an-button-click - Fired when the user activates the button; `detail.originalEvent` is the native MouseEvent.
 */
export class AnButton extends AnElement {
  static override styles: string = buttonStyles;

  /** Opts the host into form participation so `type="submit"` can submit. */
  static override formAssociated = true;

  static override defaults = {
    variant: 'default',
    size: 'md',
    disabled: false,
    loading: false,
    type: 'button',
  };

  declare variant: AnButtonVariant;
  declare size: AnButtonSize;
  declare disabled: boolean;
  declare loading: boolean;
  declare type: AnButtonType;

  /** Set by `formDisabledCallback` (e.g. a disabled ancestor `<fieldset>`). */
  #formDisabled = false;

  constructor() {
    super();
    // Delegation on the shadow root survives the innerHTML re-render.
    this.shadowRoot!.addEventListener('click', this.#onClick);
  }

  protected render(): string {
    const type = oneOf(TYPES, this.type, 'button');
    const blocked = this.disabled || this.loading || this.#formDisabled ? ' disabled' : '';
    const busy = this.loading ? ' aria-busy="true"' : '';
    return `<button class="base" part="base" type="${type}"${blocked}${busy}><slot></slot></button>`;
  }

  protected override afterRender(): void {
    const button = this.#button;
    const blocked = this.disabled || this.loading || this.#formDisabled;
    if (button) {
      button.disabled = blocked;
      if (this.loading) button.setAttribute('aria-busy', 'true');
      else button.removeAttribute('aria-busy');
    }
    // Expose the blocked state on the host as well; `internals` is absent under
    // DOM implementations without form-associated custom elements.
    if (this.internals) this.internals.ariaDisabled = blocked ? 'true' : null;
  }

  /** Mirrors a platform-level disable (e.g. ancestor `<fieldset disabled>`). */
  protected override onFormDisabled(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.requestUpdate();
  }

  #onClick = (event: Event): void => {
    if (this.disabled || this.loading || this.#formDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.emit('an-button-click', { originalEvent: event as MouseEvent });

    // The inner <button> is inside the shadow tree and therefore not part of the
    // outer form; submit/reset through the form-associated host instead.
    const form = this.#form;
    if (!form) return;
    const type = oneOf(TYPES, this.type, 'button');
    if (type === 'submit') form.requestSubmit();
    else if (type === 'reset') form.reset();
  };

  get #button(): HTMLButtonElement | null {
    return this.shadowRoot?.querySelector('button') ?? null;
  }

  /** Owning form, via the platform when available and via the tree otherwise. */
  get #form(): HTMLFormElement | null {
    return this.internals?.form ?? this.closest('form');
  }
}

export { VARIANTS, SIZES, TYPES };
