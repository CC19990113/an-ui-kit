import inputStyles from './an-input.css?inline';
import { AnElement } from '../internal/base';

/** Input types forwarded to the inner native `<input>`. */
export type AnInputType = 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number';
/** Control sizes of `<an-input>`. */
export type AnInputSize = 'sm' | 'md' | 'lg';

const TYPES: readonly AnInputType[] = ['text', 'email', 'password', 'search', 'tel', 'url', 'number'];
const SIZES: readonly AnInputSize[] = ['sm', 'md', 'lg'];

/** Shown to the owning form when `required` is set and the value is empty. */
const REQUIRED_MESSAGE = '此字段为必填项。';

/** The clear button; `#syncChrome()` reuses the same markup when it paints it. */
const CLEAR_MARKUP =
  '<span class="clear" part="clear" role="button" tabindex="0" aria-label="清空">×</span>';

function oneOf<T extends string>(allowed: readonly T[], value: string, fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Escapes text used inside an attribute value or element content. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * `<an-input>` — a single-line field backed by a real native `<input>` inside
 * the shadow root, so focus, selection, IME, autofill, `type` semantics and the
 * on-screen keyboard all come from the platform.
 *
 * The host is a form-associated custom element. The inner input lives across a
 * shadow boundary and is therefore not part of the outer `<form>`; the host
 * registers its own entry instead: `ElementInternals.setFormValue()` keeps
 * `FormData` in step with every keystroke and `setValidity()` raises
 * `valueMissing` for `required` + empty, which is what lets the outer form's
 * constraint validation block submission.
 *
 * `value` is the one piece of state that is read from its attribute but never
 * written back to it. Markup may seed the initial value; after that only the
 * property and the inner input change, so typing cannot cause IME churn or DOM
 * noise. `formResetCallback()` restores the value captured at mount time, and
 * `formDisabledCallback()` mirrors a disabled ancestor `<fieldset>`.
 *
 * @attr {string} value - Initial value. The attribute is read once and never written back on input.
 * @attr {('text'|'email'|'password'|'search'|'tel'|'url'|'number')} type - Native type forwarded to the inner `<input>`; unknown values fall back to "text". Default: "text".
 * @attr {string} placeholder - Placeholder text forwarded to the inner `<input>`.
 * @attr {string} label - Visible label. When empty no `<label>` is rendered and `aria-label`/`aria-labelledby` are forwarded from the host instead.
 * @attr {('sm'|'md'|'lg')} size - Control size. Default: "md".
 * @attr {boolean} disabled - Disables the inner input and blocks `an-input`/`an-change`.
 * @attr {boolean} readonly - Makes the inner input read-only and blocks `an-input`/`an-change`.
 * @attr {boolean} required - Participates in constraint validation (`valueMissing` when empty).
 * @attr {boolean} invalid - External error state; maps to `aria-invalid="true"` and the error border.
 * @attr {string} name - Field name used when the value is submitted with the owning form.
 * @attr {number} maxlength - Maximum character count forwarded to the inner input. `-1` means unlimited.
 * @attr {boolean} clearable - Shows a clear button while the field has a value.
 * @attr {boolean} show-count - Shows `value.length/maxlength` (or just the length without `maxlength`).
 * @attr {string} prefix - Text shown before the input; `slot="prefix"` takes priority over it.
 * @attr {string} suffix - Text shown after the input; `slot="suffix"` takes priority over it.
 * @attr {string} autocomplete - Autocomplete hint forwarded to the inner input.
 * @attr {boolean} spellcheck - Whether the platform spell-checks the value. Default: `true`.
 * @attr {string} inputmode - Virtual-keyboard hint forwarded to the inner input.
 * @fires an-input - Fired on every native input; `detail = { value, originalEvent }`.
 * @fires an-change - Fired on native change (blur or Enter); `detail = { value, originalEvent }`.
 * @fires an-input-clear - Fired after an activated clear control empties the field; `an-input` and `an-change` fire first, then `detail = { value: '' }`.
 * @slot prefix - Custom content before the input; replaces the `prefix` text.
 * @slot suffix - Custom content after the input; replaces the `suffix` text.
 * @cssprop --an-input-height - Control height; defaults to 2.25rem (2rem sm, 2.75rem lg).
 * @cssprop --an-input-bg - Control background; defaults to `--an-color-bg-1`.
 * @cssprop --an-input-fg - Text colour; defaults to `--an-color-fg-1`.
 * @cssprop --an-input-border-color - Border colour; defaults to `--an-color-border-1`.
 * @cssprop --an-input-radius - Corner radius; defaults to `--an-radius-md` (0.5rem).
 * @cssprop --an-input-font-size - Text size; defaults to `--an-font-size-sm` (0.875rem).
 * @cssprop --an-input-padding-x - Horizontal padding; defaults to `--an-space-3` (0.75rem).
 * @cssprop --an-input-focus-ring - Focus outline colour; defaults to `--an-color-accent-9`.
 * @csspart base - Outer wrapper around the label and the control.
 * @csspart label - The visible `<label>`; rendered only when `label` is non-empty.
 * @csspart input - The internal native `<input>` element.
 * @csspart prefix - Wrapper around the prefix text or `slot="prefix"`; hidden while empty.
 * @csspart suffix - Wrapper around the suffix text or `slot="suffix"`; hidden while empty.
 * @csspart clear - The clear button; rendered only while it can clear the field.
 * @csspart count - The character counter; rendered only with `show-count`.
 */
export class AnInput extends AnElement {
  static override styles: string = inputStyles;

  /** Opts the host into form participation so its value reaches the outer form. */
  static override formAssociated = true;

  /**
   * `value` is deliberately not part of `defaults`: the base class reflects
   * every default property back onto its attribute, while this component must
   * never write `value` back. It is observed and exposed manually below.
   */
  static override defaults = {
    type: 'text',
    placeholder: '',
    label: '',
    size: 'md',
    disabled: false,
    readonly: false,
    required: false,
    invalid: false,
    name: '',
    maxlength: -1,
    clearable: false,
    showCount: false,
    prefix: '',
    suffix: '',
    autocomplete: '',
    inputmode: '',
  };

  declare type: AnInputType;
  declare placeholder: string;
  declare label: string;
  declare size: AnInputSize;
  declare disabled: boolean;
  declare readonly: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare name: string;
  declare maxlength: number;
  declare clearable: boolean;
  declare showCount: boolean;
  declare prefix: string;
  declare suffix: string;
  declare autocomplete: string;
  declare inputmode: string;

  #value = '';
  #initialValue = '';
  #mounted = false;
  /** Set by `formDisabledCallback` (e.g. a disabled ancestor `<fieldset>`). */
  #formDisabled = false;
  /**
   * Spell checking sees `"false"` as a real value: `spellcheck` is an
   * enumerated HTML attribute, not a presence-only boolean, so it is managed
   * outside `defaults` while the property keeps speaking booleans. Native text
   * fields spell-check by default, hence the `true` default.
   */
  #spellcheck = true;
  /** Whether `slot="prefix"` / `slot="suffix"` carry content, kept by `slotchange`. */
  #slottedPrefix = false;
  #slottedSuffix = false;

  /** `value`, `spellcheck` and the forwarded ARIA names are observed outside `defaults`. */
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'value', 'spellcheck', 'aria-label', 'aria-labelledby'];
  }

  constructor() {
    super();
    // Delegation on the shadow root survives the innerHTML re-render.
    this.shadowRoot!.addEventListener('input', this.#onInput);
    this.shadowRoot!.addEventListener('change', this.#onChange);
    this.shadowRoot!.addEventListener('click', this.#onClick);
    this.shadowRoot!.addEventListener('keydown', this.#onKeyDown as EventListener);
    this.shadowRoot!.addEventListener('slotchange', this.#onSlotChange);
  }

  /** Current value. Setting it updates the inner input without re-rendering. */
  get value(): string {
    return this.#value;
  }

  set value(next: string) {
    this.#setValue(next);
  }

  /** The attribute seeds the value; it is never written back by the property. */
  override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (name === 'value') {
      if (oldValue !== value) this.#setValue(value ?? '');
      return;
    }
    if (name === 'spellcheck') {
      // `spellcheck` is enumerated: only the literal "false" disables it.
      // Update the live node in place so changing this hint does not interrupt IME.
      if (oldValue !== value) {
        this.#spellcheck = value !== 'false';
        if (this.#input) {
          if (this.#spellcheck) this.#input.removeAttribute('spellcheck');
          else this.#input.setAttribute('spellcheck', 'false');
        }
      }
      return;
    }
    if (name === 'aria-label' || name === 'aria-labelledby') {
      // Forwarded to the inner input only while no visible label exists.
      if (oldValue !== value && !this.label) this.requestUpdate();
      return;
    }
    super.attributeChangedCallback(name, oldValue, value);
  }

  protected render(): string {
    const type = oneOf(TYPES, this.type, 'text');
    const disabled = this.disabled || this.#formDisabled;
    const attrs =
      ` class="input" part="input" type="${type}"` +
      (this.maxlength >= 0 ? ` maxlength="${this.maxlength}"` : '') +
      (this.placeholder ? ` placeholder="${escapeHtml(this.placeholder)}"` : '') +
      (this.autocomplete ? ` autocomplete="${escapeHtml(this.autocomplete)}"` : '') +
      (this.inputmode ? ` inputmode="${escapeHtml(this.inputmode)}"` : '') +
      (this.#spellcheck ? '' : ' spellcheck="false"') +
      (disabled ? ' disabled aria-disabled="true"' : '') +
      (this.readonly ? ' readonly aria-readonly="true"' : '') +
      (this.required ? ' required aria-required="true"' : '') +
      (this.invalid ? ' aria-invalid="true"' : '') +
      (this.label ? '' : this.#forwardedName());
    const input = `<input${attrs}>`;
    const prefix = this.#affix('prefix');
    const suffix = this.#affix('suffix');
    // A hidden slot keeps `slotchange` reachable while no affix is painted, so
    // content added later still replaces the empty wrapper.
    const probes =
      (prefix ? '' : '<slot name="prefix" class="probe"></slot>') +
      (suffix ? '' : '<slot name="suffix" class="probe"></slot>');
    const clear = this.#canClear() ? CLEAR_MARKUP : '';
    const count = this.showCount
      ? `<span class="count" part="count">${this.#value.length}${this.maxlength >= 0 ? `/${this.maxlength}` : ''}</span>`
      : '';
    const control = `<span class="control">${prefix}${input}${clear}${suffix}${count}${probes}</span>`;
    return this.label
      ? `<div class="base" part="base"><label class="label" part="label"><span class="label-text">${escapeHtml(this.label)}</span>${control}</label></div>`
      : `<div class="base" part="base">${control}</div>`;
  }

  /**
   * The prefix / suffix wrapper, painted only when it carries text or slotted
   * content. Once content is slotted in, the text is dropped so the slot is the
   * only thing inside the wrapper.
   */
  #affix(name: 'prefix' | 'suffix'): string {
    const slotted = name === 'prefix' ? this.#slottedPrefix : this.#slottedSuffix;
    const text = name === 'prefix' ? this.prefix : this.suffix;
    if (!slotted && !text) return '';
    const content = slotted
      ? `<slot name="${name}"></slot>`
      : `<slot name="${name}">${escapeHtml(text)}</slot>`;
    return `<span class="affix ${name}" part="${name}">${content}</span>`;
  }

  /** Whether the clear button may act on the current state. */
  #canClear(): boolean {
    return (
      this.clearable &&
      !this.disabled &&
      !this.#formDisabled &&
      !this.readonly &&
      this.#value !== ''
    );
  }

  /**
   * Brings the clear button and the counter in line with the current value
   * *in place*. Re-rendering here would replace the `<input>` node and abort an
   * in-progress IME composition, so only the two chrome nodes are touched.
   */
  #syncChrome(): void {
    const control = this.shadowRoot?.querySelector('.control');
    if (!control) return;
    const clear = control.querySelector('.clear');
    const count = control.querySelector('.count');
    const suffix = control.querySelector('.affix.suffix');

    if (this.#canClear()) {
      if (!clear) {
        control.insertBefore(this.#parse(CLEAR_MARKUP), suffix ?? count ?? null);
      }
    } else if (clear) {
      clear.remove();
    }

    const text = `${this.#value.length}${this.maxlength >= 0 ? `/${this.maxlength}` : ''}`;
    if (!this.showCount) {
      if (count) count.remove();
      return;
    }
    if (!count) {
      control.append(this.#parse(`<span class="count" part="count">${text}</span>`));
      return;
    }
    if (count.textContent !== text) count.textContent = text;
  }

  /** Turns a markup fragment into its first element. */
  #parse(html: string): Element {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.firstElementChild as Element;
  }

  protected override afterRender(): void {
    this.#applyValue();
    const internals = this.internals;
    if (!internals) return;
    const disabled = this.disabled || this.#formDisabled;
    internals.ariaDisabled = disabled ? 'true' : null;
    internals.ariaReadOnly = this.readonly ? 'true' : null;
    internals.ariaRequired = this.required ? 'true' : null;
    internals.ariaInvalid = this.invalid ? 'true' : null;
    this.#syncForm();
  }

  /** Remembers the value the element was mounted with (the reset target). */
  protected override onConnect(): void {
    if (this.#mounted) return;
    this.#mounted = true;
    this.#initialValue = this.#value;
  }

  protected override onFormReset(): void {
    this.#setValue(this.#initialValue);
  }

  /** Mirrors a platform-level disable (e.g. ancestor `<fieldset disabled>`). */
  protected override onFormDisabled(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.requestUpdate();
  }

  #setValue(next: string): void {
    const value = next === null || next === undefined ? '' : String(next);
    if (value === this.#value) return;
    this.#value = value;
    this.#applyValue();
    this.#syncForm();
    this.#syncChrome();
  }

  /** Writes the value into the live input, keeping the caret where it was. */
  #applyValue(): void {
    const input = this.#input;
    if (!input || input.value === this.#value) return;
    const focused = this.shadowRoot?.activeElement === input;
    let caret = this.#value.length;
    if (focused) {
      try {
        caret = input.selectionStart ?? caret;
      } catch {
        // `<input type="number">` has no selection API.
      }
    }
    input.value = this.#value;
    if (!focused) return;
    const position = Math.min(caret, this.#value.length);
    try {
      input.setSelectionRange(position, position);
    } catch {
      // `<input type="number">` has no selection API.
    }
  }

  /**
   * Publishes the value and the constraint to the owning form.
   *
   * A disabled control is *barred from constraint validation* and contributes no
   * entry, exactly like a native `<input disabled>`: `setFormValue(null)` keeps it
   * out of `FormData` and `setValidity({})` keeps it from blocking the outer form.
   * `#formDisabled` is the same state reached through an ancestor
   * `<fieldset disabled>` (the platform reports it via `formDisabledCallback`).
   *
   * A read-only control is the opposite case, again like the native element: it
   * still contributes its value (a native `<input readonly>` is never excluded
   * from `FormData`), but it is barred from constraint validation, so `required`
   * on an empty read-only field must not block the outer form.
   */
  #syncForm(): void {
    const internals = this.internals;
    if (!internals) return;
    if (this.disabled || this.#formDisabled) {
      internals.setFormValue(null);
      internals.setValidity({});
      return;
    }
    internals.setFormValue(this.#value);
    // Blank means "nothing typed": whitespace-only input is not a value, matching
    // `<an-textarea>` and the way a native required text field treats `"   "`.
    if (!this.readonly && this.required && this.#value.trim() === '') {
      const input = this.#input;
      internals.setValidity({ valueMissing: true }, REQUIRED_MESSAGE, input ?? undefined);
    } else {
      internals.setValidity({});
    }
  }

  /** `aria-label` / `aria-labelledby` only when no visible `<label>` exists. */
  #forwardedName(): string {
    const label = this.getAttribute('aria-label');
    const labelledby = this.getAttribute('aria-labelledby');
    return (
      (label ? ` aria-label="${escapeHtml(label)}"` : '') +
      (labelledby ? ` aria-labelledby="${escapeHtml(labelledby)}"` : '')
    );
  }

  #handle(event: Event, name: 'an-input' | 'an-change'): void {
    const input = this.#input;
    if (!input || event.target !== input || this.disabled || this.readonly || this.#formDisabled) return;
    this.#value = input.value;
    this.#syncForm();
    // The counter and the clear button follow the value, so they are updated
    // before the event leaves the element.
    this.#syncChrome();
    this.emit(name, { value: this.#value, originalEvent: event });
  }

  /** Delegated click on the shadow root: only the clear control acts. */
  #onClick = (event: Event): void => {
    const target = event.target as Element | null;
    const clear = target?.closest('.clear');
    if (!clear || clear.getAttribute('aria-disabled') === 'true') return;
    event.preventDefault();
    event.stopPropagation();
    this.#clear(event);
  };

  /** A role=button clear affordance needs native button keyboard activation. */
  #onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as Element | null;
    const clear = target?.closest('.clear');
    if (!clear || (event.key !== 'Enter' && event.key !== ' ')) return;
    if (clear.getAttribute('aria-disabled') === 'true') return;
    event.preventDefault();
    event.stopPropagation();
    // Space activates on keydown; preventDefault avoids page scrolling.
    this.#clear(event);
  };

  /** Clears form state first, then follows the normal value-event chain. */
  #clear(originalEvent: Event): void {
    if (!this.#canClear()) return;
    this.#setValue('');
    const detail = { value: '', originalEvent };
    this.emit('an-input', detail);
    this.emit('an-change', detail);
    this.emit('an-input-clear', { value: '' });
    this.#input?.focus();
  }

  /**
   * A slot is meaningful when it receives an element (including an empty SVG)
   * or non-whitespace text. Fallback children are not assigned and do not count.
   */
  #onSlotChange = (): void => {
    const root = this.shadowRoot;
    if (!root) return;
    const has = (name: 'prefix' | 'suffix'): boolean => {
      const slot = root.querySelector<HTMLSlotElement>(`slot[name="${name}"]`);
      if (!slot) return false;
      return slot.assignedNodes({ flatten: true }).some((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) return true;
        return node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0;
      });
    };
    const prefix = has('prefix');
    const suffix = has('suffix');
    if (prefix === this.#slottedPrefix && suffix === this.#slottedSuffix) return;
    this.#slottedPrefix = prefix;
    this.#slottedSuffix = suffix;
    this.requestUpdate();
  };

  #onInput = (event: Event): void => {
    this.#handle(event, 'an-input');
  };

  #onChange = (event: Event): void => {
    this.#handle(event, 'an-change');
  };

  /**
   * Platform parity for form-associated custom elements: the host carries no
   * `validationMessage` of its own, so the message the platform computed is read
   * off the internals here — this is what `<an-field>` displays.
   */
  get validationMessage(): string {
    return this.internals?.validationMessage ?? '';
  }

  /** Platform constraint state; `undefined` when the element has no internals. */
  get validity(): ValidityState | undefined {
    return this.internals?.validity;
  }

  get #input(): HTMLInputElement | null {
    return this.shadowRoot?.querySelector('input') ?? null;
  }
}

export { SIZES, TYPES };
