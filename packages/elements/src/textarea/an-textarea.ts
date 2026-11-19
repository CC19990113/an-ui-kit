import textareaStyles from './an-textarea.css?inline';
import { AnElement } from '../internal/base';

/** Resize handles exposed by `<an-textarea>` (drives the inner `resize`). */
export type AnTextareaResize = 'none' | 'vertical' | 'both';

/** Shown to the owning form when `required` is set and the value is blank. */
const REQUIRED_MESSAGE = '此字段为必填项。';

/** Escapes text used inside an attribute value or element content. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * `<an-textarea>` — a multi-line field backed by a real native `<textarea>`
 * inside the shadow root, so focus, selection, wrapping, IME, autofill, the
 * `maxlength` counter and the on-screen keyboard all come from the platform.
 *
 * The host is a form-associated custom element. The inner textarea lives across
 * a shadow boundary and is therefore not part of the outer `<form>`; the host
 * registers its own entry instead: `ElementInternals.setFormValue()` keeps
 * `FormData` in sync, `setValidity()` carries `required`, and
 * `formResetCallback` restores the initial value.
 *
 * `value` only ever seeds the element: typing writes the property, never the
 * attribute, so the markup stays the initial value it was authored with.
 *
 * @attr value - Initial text; typed input does not write it back.
 * @attr placeholder - Hint shown while empty.
 * @attr label - Visible `<label>` text; omitted when empty.
 * @attr rows - Visible row count of the inner textarea. Default `3`.
 * @attr maxlength - Maximum character count, forwarded to the inner textarea. `-1` means unlimited.
 * @attr resize - Resize handles: `none`, `vertical` (default) or `both`.
 * @attr disabled - Bars interaction, constraint validation and form submission.
 * @attr readonly - Keeps the value submittable but exempts it from validation.
 * @attr required - Marks the field as mandatory; blank (trimmed) values fail.
 * @attr invalid - Renders the invalid state (`aria-invalid`).
 * @attr name - Entry name used by the owning form's `FormData`.
 * @fires an-textarea-input - On every input; `detail = { value, originalEvent }`.
 * @fires an-textarea-change - On the native `change`; `detail = { value, originalEvent }`.
 * @cssprop [--an-textarea-min-height] - Lowest height of the control.
 * @cssprop [--an-textarea-bg] - Background colour.
 * @cssprop [--an-textarea-fg] - Text colour.
 * @cssprop [--an-textarea-border-color] - Border colour.
 * @cssprop [--an-textarea-radius] - Corner radius.
 * @cssprop [--an-textarea-font-size] - Text size.
 * @cssprop [--an-textarea-padding] - Inner padding shorthand.
 * @cssprop [--an-textarea-focus-ring] - Focus outline and border colour.
 * @csspart base - The wrapper around label and control.
 * @csspart label - The visible `<label>`; rendered only when `label` is non-empty.
 * @csspart textarea - The internal native `<textarea>` element.
 */
export class AnTextarea extends AnElement {
  static override styles: string = textareaStyles;

  /** Opts the host into form participation so its value reaches the outer form. */
  static override formAssociated = true;

  /**
   * `value` is deliberately not part of `defaults`: the base class reflects
   * every default property back onto its attribute, while this component must
   * never write `value` back. It is observed and exposed manually below.
   */
  static override defaults = {
    placeholder: '',
    label: '',
    rows: 3,
    maxlength: -1,
    resize: 'vertical',
    disabled: false,
    readonly: false,
    required: false,
    invalid: false,
    name: '',
  };

  declare placeholder: string;
  declare label: string;
  declare rows: number;
  declare maxlength: number;
  declare resize: AnTextareaResize;
  declare disabled: boolean;
  declare readonly: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare name: string;

  #value = '';
  #initialValue = '';
  #mounted = false;
  /** Set by `formDisabledCallback` (e.g. a disabled ancestor `<fieldset>`). */
  #formDisabled = false;

  /** `value` and the forwarded ARIA names are observed outside `defaults`. */
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'value', 'aria-label', 'aria-labelledby'];
  }

  constructor() {
    super();
    // Delegation on the shadow root survives the innerHTML re-render.
    this.shadowRoot!.addEventListener('input', this.#onInput);
    this.shadowRoot!.addEventListener('change', this.#onChange);
  }

  /** Current value. Setting it updates the inner textarea without re-rendering. */
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
    if (name === 'aria-label' || name === 'aria-labelledby') {
      // Forwarded to the inner textarea only while no visible label exists.
      if (oldValue !== value && !this.label) this.requestUpdate();
      return;
    }
    super.attributeChangedCallback(name, oldValue, value);
  }

  protected render(): string {
    const disabled = this.disabled || this.#formDisabled;
    const attrs =
      ` class="textarea" part="textarea" rows="${this.rows}"` +
      (this.placeholder ? ` placeholder="${escapeHtml(this.placeholder)}"` : '') +
      (this.maxlength >= 0 ? ` maxlength="${this.maxlength}"` : '') +
      (disabled ? ' disabled aria-disabled="true"' : '') +
      (this.readonly ? ' readonly aria-readonly="true"' : '') +
      (this.required ? ' required aria-required="true"' : '') +
      (this.invalid ? ' aria-invalid="true"' : '') +
      (this.label ? '' : this.#forwardedName());
    const textarea = `<textarea${attrs}></textarea>`;
    return this.label
      ? `<div class="base" part="base"><label class="label" part="label"><span class="label-text">${escapeHtml(this.label)}</span>${textarea}</label></div>`
      : `<div class="base" part="base">${textarea}</div>`;
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
  }

  /** Writes the value into the live textarea, keeping the caret where it was. */
  #applyValue(): void {
    const textarea = this.#textarea;
    if (!textarea || textarea.value === this.#value) return;
    const focused = this.shadowRoot?.activeElement === textarea;
    let caret = this.#value.length;
    if (focused) {
      try {
        caret = textarea.selectionStart ?? caret;
      } catch {
        // Detached or non-text controls may not expose a selection.
      }
    }
    textarea.value = this.#value;
    if (!focused) return;
    const position = Math.min(caret, this.#value.length);
    try {
      textarea.setSelectionRange(position, position);
    } catch {
      // Detached or non-text controls may not expose a selection.
    }
  }

  /**
   * Publishes the value and the constraint to the owning form.
   *
   * A disabled control is *barred from constraint validation* and contributes no
   * entry, exactly like a native `<textarea disabled>`: `setFormValue(null)` keeps
   * it out of `FormData` and `setValidity({})` keeps it from blocking the outer
   * form. `#formDisabled` is the same state reached through an ancestor
   * `<fieldset disabled>` (the platform reports it via `formDisabledCallback`).
   *
   * A read-only control is the opposite case, again like the native element: it
   * still contributes its value (a native `<textarea readonly>` is never excluded
   * from `FormData`), but it is barred from constraint validation, so `required`
   * on a blank read-only field must not block the outer form.
   *
   * `required` compares the *trimmed* value, so a field holding only whitespace
   * counts as empty, matching how the platform treats `<textarea required>`.
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
    if (!this.readonly && this.required && this.#value.trim() === '') {
      const textarea = this.#textarea;
      internals.setValidity({ valueMissing: true }, REQUIRED_MESSAGE, textarea ?? undefined);
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

  #handle(event: Event, name: 'an-textarea-input' | 'an-textarea-change'): void {
    const textarea = this.#textarea;
    if (!textarea || event.target !== textarea || this.disabled || this.readonly || this.#formDisabled) return;
    this.#value = textarea.value;
    this.#syncForm();
    this.emit(name, { value: this.#value, originalEvent: event });
  }

  #onInput = (event: Event): void => {
    this.#handle(event, 'an-textarea-input');
  };

  #onChange = (event: Event): void => {
    this.#handle(event, 'an-textarea-change');
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

  get #textarea(): HTMLTextAreaElement | null {
    return this.shadowRoot?.querySelector('textarea') ?? null;
  }
}
