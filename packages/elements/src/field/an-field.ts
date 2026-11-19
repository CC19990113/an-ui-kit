import fieldStyles from './an-field.css?inline';
import { AnElement } from '../internal/base';

/** Shown when a control reports `invalid` but carries no platform message. */
const FALLBACK_ERROR = '请输入有效值';

/** Native controls that can receive the field's accessible name and state. */
const NATIVE_CONTROLS = new Set(['input', 'textarea', 'select', 'button']);

/**
 * Events a slotted control dispatches after its value changed. Any of them
 * clears the error text captured from an earlier `invalid` event.
 */
const CHANGE_EVENTS = [
  'input',
  'change',
  'an-input',
  'an-change',
  'an-checkbox-change',
  'an-switch-change',
  'an-radio-change',
  'an-select-change',
  'an-textarea-change',
  'an-checkbox-group-change',
  'an-number-change',
  'an-date-change',
  'an-date-range-change',
  'an-upload-change',
] as const;

/** Classic `<p id="x">` counter, so every field gets stable, unique ids. */
let nextId = 0;

/** Escapes text used inside an attribute value or element content. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** A slotted control that may expose the platform validation message. */
type ValidationTarget = EventTarget & { validationMessage?: string };

/**
 * Non-empty platform validation message carried by `target`.
 *
 * Every form-associated element in this package exposes `validationMessage` as a
 * getter (the host itself has none), and a native control carries the property
 * natively, so one read covers both; a target without the property yields `''`
 * and the caller falls back to its own text.
 */
function readValidationMessage(target: EventTarget | null | undefined): string {
  const message = (target as ValidationTarget | null | undefined)?.validationMessage;
  return typeof message === 'string' ? message.trim() : '';
}

/**
 * `<an-field>` — layout and error display for one form control.
 *
 * The element is deliberately **not** form-associated: `<an-input>`,
 * `<an-textarea>`, `<an-select>` and friends already participate in the native
 * `<form>`, so `requestSubmit()`, `FormData`, `reset()` and constraint
 * validation keep working without a wrapper. `<an-field>` only renders the
 * label/hint/error chrome, links them to the slotted control, and mirrors the
 * platform's own constraint message.
 *
 * Validation is never re-implemented here. The error text comes from the
 * `validationMessage` of whichever control dispatched `invalid`, caught during
 * the capture phase because `invalid` does not bubble. A non-empty `error`
 * attribute wins over that captured text.
 *
 * The host carries no observable attributes of its own beyond the four below;
 * `required` is presentational only (a star plus `aria-required`) and neither
 * marks the slotted control valid nor invalid.
 *
 * @attr label - Visible label text; the star follows it when `required` is set.
 * @attr hint - Secondary help text shown under the control.
 * @attr error - Forces the error message and wins over the captured one.
 * @attr required - Marks the field as required for presentation (`aria-required`).
 *
 * @slot - Direct native or form-associated custom controls receive the field's label and state.
 *
 * @cssprop --an-field-gap - Space between label, control, hint and error; defaults to `--an-space-2` (0.5rem).
 * @cssprop --an-field-label-font-size - Label text size; defaults to `--an-font-size-sm` (0.875rem).
 * @cssprop --an-field-hint-color - Hint colour; defaults to `--an-color-fg-1` weakened to 62%.
 * @cssprop --an-field-error-color - Error colour; defaults to `--an-color-danger-9`.
 * @csspart base - Column wrapper around the label, control, hint and error.
 * @csspart label - The `<label>`; rendered empty and hidden when `label` is unset.
 * @csspart required - The `*` after the label text; rendered only when `required` is set.
 * @csspart control - Wrapper around the `<slot>`; carries `data-invalid` while an error shows.
 * @csspart hint - The `<p>` hint; hidden while `hint` is empty.
 * @csspart error - The `<p role="alert">` error; hidden while no error shows.
 */
export class AnField extends AnElement {
  static override styles: string = fieldStyles;

  static override defaults = {
    label: '',
    hint: '',
    error: '',
    required: false,
  };

  declare label: string;
  declare hint: string;
  declare error: string;
  declare required: boolean;

  /** Constraint message captured from a control's `invalid` event. */
  #autoError = '';
  /** Control that dispatched the `invalid` event, if any. */
  #invalidTarget: Element | null = null;
  /**
   * Attributes this element wrote onto a control, keyed by control. Cleanup and
   * the "the author already linked this" checks both read it, so a consumer's
   * own `aria-label` / `aria-describedby` is never removed or overwritten.
   */
  #written = new WeakMap<Element, Set<string>>();
  #labelId = `an-field-${++nextId}-label`;
  #hintId = `an-field-${nextId}-hint`;
  #errorId = `an-field-${nextId}-error`;

  constructor() {
    super();
    // `invalid` never bubbles; a capture listener on the host is the only way to
    // see it. It is not composed either, so an inner native input inside a
    // control's own shadow root stays out of this listener — exactly what we want.
    this.addEventListener('invalid', this.#onInvalid, true);
    for (const type of CHANGE_EVENTS) this.addEventListener(type, this.#onValueChange);
  }

  protected render(): string {
    const error = this.#displayError;
    const label =
      `<label class="label" part="label" id="${this.#labelId}"${this.label ? '' : ' hidden'}>` +
      escapeHtml(this.label) +
      (this.required ? '<span class="required" part="required" aria-hidden="true">*</span>' : '') +
      '</label>';
    const hint = `<p class="hint" part="hint" id="${this.#hintId}"${this.hint ? '' : ' hidden'}>${escapeHtml(this.hint)}</p>`;
    const errorText = `<p class="error" part="error" id="${this.#errorId}" role="alert"${error ? '' : ' hidden'}>${escapeHtml(error)}</p>`;
    const control = `<div class="control" part="control"${error ? ' data-invalid=""' : ''}><slot></slot></div>`;

    return `<div class="base" part="base">${label}${control}${hint}${errorText}</div>`;
  }

  protected override afterRender(): void {
    const slot = this.shadowRoot?.querySelector('slot');
    slot?.addEventListener('slotchange', this.#onSlotChange);
    this.#linkAll();
  }

  #onSlotChange = (): void => {
    this.#linkAll();
  };

  #linkAll(): void {
    for (const control of Array.from(this.children)) {
      const ctor = customElements.get(control.localName) as
        | (CustomElementConstructor & { formAssociated?: boolean })
        | undefined;
      // Layout containers (even named ones) must not inherit control-only ARIA.
      if (!NATIVE_CONTROLS.has(control.localName) && ctor?.formAssociated !== true) continue;
      this.#link(control);
    }
  }

  /** Mirrors label/hint/error text because IDREFs cannot cross a shadow boundary. */
  #link(control: Element): void {
    const error = this.#displayError;
    const target = this.#invalidTarget;
    // A captured message belongs to one control; an `error` attribute describes
    // the whole field, so every control inherits it.
    const attached = target !== null && target.isConnected && this.contains(target);
    const invalid = error && (!attached || target === control) ? 'true' : null;
    const nameable =
      this.label !== '' &&
      !control.hasAttribute('label') &&
      this.#external(control, 'aria-label') === null &&
      this.#external(control, 'aria-labelledby') === null;
    const hasText = this.hint !== '' || error !== '';
    const text = [this.hint, error].filter(Boolean).join(' ');

    this.#write(control, 'aria-labelledby', null);
    this.#write(control, 'aria-label', nameable ? this.label : null);
    this.#write(control, 'aria-describedby', null);
    this.#write(control, 'aria-description', hasText && this.#external(control, 'aria-description') === null ? text : null);
    this.#write(control, 'aria-required', this.required ? 'true' : null);
    this.#write(control, 'aria-invalid', invalid);
  }

  /** Current attribute value of `control`, ignoring values this field wrote. */
  #external(control: Element, name: string): string | null {
    return this.#written.get(control)?.has(name) ? null : control.getAttribute(name);
  }

  /** Sets or removes `name` on `control`, remembering ownership for cleanup. */
  #write(control: Element, name: string, value: string | null): void {
    const written = this.#written.get(control) ?? new Set<string>();

    if (value === null) {
      if (!written.delete(name)) return;
      this.#written.set(control, written);
      control.removeAttribute(name);
      return;
    }

    written.add(name);
    this.#written.set(control, written);
    if (control.getAttribute(name) !== value) control.setAttribute(name, value);
  }

  /** Error text actually shown: the attribute wins over the captured message. */
  get #displayError(): string {
    return this.error || this.#autoError;
  }

  #onInvalid = (event: Event): void => {
    if (!this.#owns(event.target)) return;

    const target = event.target as ValidationTarget;
    // The control reports the message through its own getter; an empty or absent
    // one falls back to the local text rather than showing nothing.
    const message = readValidationMessage(target) || FALLBACK_ERROR;
    const moved = this.#invalidTarget !== target;
    this.#invalidTarget = target as Element;

    if (this.#autoError !== message) this.#setAutoError(message);
    // Two controls can report the same text; `aria-invalid` still moves to the
    // control that reported last.
    else if (moved) this.requestUpdate();
  };

  #onValueChange = (event: Event): void => {
    if (!this.#owns(event.target)) return;
    this.#invalidTarget = null;
    this.#setAutoError('');
  };

  /**
   * Whether `target` is a control this field owns. A nested `<an-field>` owns
   * its own controls, so its events are not allowed to leak into this one.
   */
  #owns(target: EventTarget | null): target is Element {
    return target instanceof Element && this.contains(target) && target.closest('an-field') === this;
  }

  #setAutoError(message: string): void {
    if (this.#autoError === message) return;
    this.#autoError = message;
    this.requestUpdate();
  }
}
