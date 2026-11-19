import switchStyles from './an-switch.css?inline';
import { AnElement } from '../internal/base';

/** Payload of the `an-switch-change` event. */
export interface AnSwitchChangeDetail {
  /** State of the control after the change. */
  checked: boolean;
  /** Value submitted with the form when the control is on. */
  value: string;
  /** The native event that triggered the change. */
  originalEvent: Event;
}

/** Shown to the owning form when `required` is set and the switch is off. */
const REQUIRED_MESSAGE = '此字段为必填项。';

/** Elements whose clicks a native `<label>` does *not* forward to its control. */
const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [contenteditable]';

/** Escapes text used inside an attribute value. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * `<an-switch>` — an on/off control built on a native `<input type="checkbox">`
 * with `role="switch"` inside the shadow root, so focus, Space toggling and the
 * accessible checked state all come from the platform.
 *
 * The default slot is the visible label and lives inside the `<label>` that
 * wraps the input, which is what gives the switch its accessible name.
 *
 * `checked` is public state and therefore an attribute-backed property: a user
 * toggle writes the `checked` attribute back, so markup, property and the
 * submitted value never disagree.
 *
 * The host is form-associated. The inner input sits behind a shadow boundary and
 * is not part of the outer `<form>`; the host registers the entry itself:
 * `setFormValue(value)` while on, `setFormValue(null)` while off, and
 * `setValidity({ valueMissing })` for `required` + off, which is what lets the
 * outer form's constraint validation block submission.
 *
 * @attr {boolean} checked - On/off state; a user toggle writes the attribute back and `form.reset()` restores the mounted initial value. Default: false.
 * @attr {boolean} disabled - Bars interaction, constraint validation and form submission; also mirrored from a disabled ancestor `<fieldset>`. Default: false.
 * @attr {boolean} required - Participates in constraint validation (`valueMissing` when off). Default: false.
 * @attr {string} name - Field name used when the value is submitted with the owning form.
 * @attr {string} value - Value submitted while the switch is on. Default: "on".
 * @slot - Label text of the control.
 * @fires an-switch-change - Fired after a user toggle; `detail` carries `checked`, `value` and `originalEvent`.
 * @csspart base - The `<label>` wrapper.
 * @csspart track - The groove behind the thumb.
 * @csspart thumb - The moving knob.
 * @csspart label - The slot wrapper.
 * @cssprop --an-switch-width - Track width; defaults to `2.25rem`.
 * @cssprop --an-switch-height - Track height; defaults to `1.25rem`.
 * @cssprop --an-switch-thumb-size - Thumb diameter; defaults to `1rem`.
 * @cssprop --an-switch-accent - On-state track colour; defaults to `--an-color-accent-9`.
 */
export class AnSwitch extends AnElement {
  static override styles: string = switchStyles;

  /** The host owns the form entry; the inner input lives behind a shadow boundary. */
  static override formAssociated = true;

  static override defaults = {
    checked: false,
    disabled: false,
    required: false,
    name: '',
    value: 'on',
  };

  declare checked: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare name: string;
  declare value: string;

  /** Reset target: the state the element was mounted with. */
  #initialChecked = false;
  #mounted = false;
  /** Set by `formDisabledCallback` (e.g. a disabled ancestor `<fieldset>`). */
  #formDisabled = false;

  constructor() {
    super();
    // Delegation on the shadow root survives the innerHTML re-render. Clicks are
    // handled in the capture phase: cancelling the label's default activation has
    // to happen before the `<label>` between the root and the target reacts.
    this.shadowRoot!.addEventListener('click', this.#onClick, true);
    this.shadowRoot!.addEventListener('change', this.#onChange);
  }

  /** Remembers the checked state the element was mounted with (the reset target). */
  protected override onConnect(): void {
    if (this.#mounted) return;
    this.#mounted = true;
    this.#initialChecked = this.checked;
    this.#syncForm();
  }

  protected override onFormReset(): void {
    this.checked = this.#initialChecked;
  }

  /** Mirrors a platform-level disable (e.g. ancestor `<fieldset disabled>`). */
  protected override onFormDisabled(disabled: boolean): void {
    this.#formDisabled = disabled;
    // Styling hook only; `disabled` itself stays the author's attribute.
    this.toggleAttribute('data-form-disabled', disabled);
    this.requestUpdate();
  }

  protected render(): string {
    const disabled = this.disabled || this.#formDisabled;
    const attrs =
      ` class="native" type="checkbox" role="switch"` +
      ` value="${escapeHtml(this.value)}"` +
      (this.name ? ` name="${escapeHtml(this.name)}"` : '') +
      (this.checked ? ' checked aria-checked="true"' : ' aria-checked="false"') +
      (disabled ? ' disabled aria-disabled="true"' : '') +
      (this.required ? ' required aria-required="true"' : '');
    return (
      '<label class="base" part="base">' +
      `<input${attrs}>` +
      '<span class="track" part="track" aria-hidden="true">' +
      '<span class="thumb" part="thumb"></span>' +
      '</span>' +
      '<span class="label" part="label"><slot></slot></span>' +
      '</label>'
    );
  }

  protected override afterRender(): void {
    const input = this.#input;
    // The markup already carries `checked`; re-assert for the paths that do not
    // re-render (e.g. a native click the platform handled before `change`).
    if (input) input.checked = this.checked;
    this.#syncForm();
  }

  /**
   * Routes every click through the native input so one click toggles exactly
   * once: a click that lands on the input is left to the platform, anything else
   * (the label text, the track) cancels the label's default activation and
   * forwards a single `input.click()`.
   */
  #onClick = (event: Event): void => {
    if (this.disabled || this.#formDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const input = this.#input;
    const target = event.target;
    if (!input || target === input) return;
    // Match a native `<label>`: clicks on interactive content do not reach the control.
    if (target instanceof Element && target.closest(INTERACTIVE)) return;
    event.preventDefault();
    // A label click focuses its control natively; keep that so the keyboard stays
    // on the track after the pointer interaction. The change handler then restores
    // focus across the re-render.
    input.focus({ preventScroll: true });
    input.click();
  };

  #onChange = (event: Event): void => {
    const input = this.#input;
    if (!input || event.target !== input) return;
    if (this.disabled || this.#formDisabled) return;
    const checked = input.checked;
    const value = this.value;
    // Writing the property re-renders the shadow root, so keep focus where it was.
    const focused = this.shadowRoot?.activeElement === input;
    if (this.checked !== checked) this.checked = checked;
    if (focused) this.#input?.focus({ preventScroll: true });

    const detail: AnSwitchChangeDetail = { checked, value, originalEvent: event };
    this.emit('an-switch-change', detail);
  };

  /**
   * Publishes the value and the constraint to the owning form.
   *
   * A disabled control is *barred from constraint validation* and contributes no
   * entry, exactly like a native `<input type="checkbox" disabled>`;
   * `required` + off raises `valueMissing` against the inner input, so the
   * browser reports the message next to the control.
   */
  #syncForm(): void {
    const internals = this.internals;
    if (!internals) return;
    if (this.disabled || this.#formDisabled) {
      internals.setFormValue(null);
      internals.setValidity({});
      return;
    }
    internals.setFormValue(this.checked ? this.value : null);
    if (this.required && !this.checked) {
      internals.setValidity({ valueMissing: true }, REQUIRED_MESSAGE, this.#input ?? undefined);
    } else {
      internals.setValidity({});
    }
  }

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
