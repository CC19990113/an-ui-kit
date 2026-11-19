import numberStyles from './an-number.css?inline';
import { AnElement } from '../internal/base';

/** Control sizes of `<an-number>`. */
export type AnNumberSize = 'sm' | 'md' | 'lg';

/** Payload of the `an-number-change` event. */
export interface AnNumberChangeDetail {
  /** Parsed value after the change; `null` when the text is empty or not a number. */
  value: number | null;
  /** The event that caused the change (a synthetic `change` event for programmatic steps). */
  originalEvent: Event;
}

/** Delay before a held stepper button starts repeating, in milliseconds. */
export const STEP_HOLD_DELAY = 400;

/** Interval between repeats while a stepper button is held, in milliseconds. */
export const STEP_REPEAT_INTERVAL = 80;

/** Shown to the owning form when `required` is set and the field is empty. */
const REQUIRED_MESSAGE = '此字段为必填项。';

/** Shown to the owning form when the text cannot be parsed as a number. */
const BAD_INPUT_MESSAGE = '请输入有效的数字。';

/**
 * Digits accepted while typing. `-`, `.`, `1.` and `1.2` are intentionally
 * accepted so the text can pass through those states; a number is committed only
 * on blur or Enter.
 */
const NUMBER_PATTERN = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/;

/** Flags this element can raise; a subset of the platform `ValidityStateFlags`. */
type NumberValidityFlags = Partial<
  Record<'valueMissing' | 'badInput' | 'rangeUnderflow' | 'rangeOverflow' | 'stepMismatch', boolean>
>;

/** The element's own constraint state, mirrored into `ElementInternals`. */
interface NumberValidation {
  flags: NumberValidityFlags;
  message: string;
  invalid: boolean;
}

/** Parses committed text; returns `null` when it is not a finite number. */
function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '' || !NUMBER_PATTERN.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Canonical text for a number: no exponent noise, no trailing zeros, no `-0`. */
function canonical(value: number): string {
  if (!Number.isFinite(value)) return '';
  const clean = Math.abs(value) < 1e15 ? Number(value.toFixed(10)) : value;
  return Object.is(clean, -0) ? '0' : String(clean);
}

/** Rounds to `digits` decimals through the decimal string form, so 1.005 -> 1.01. */
function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  const shifted = Number(`${value}e${digits}`);
  const scaled = Number.isFinite(shifted) ? shifted : value * factor;
  const rounded = (Math.sign(scaled) * Math.round(Math.abs(scaled))) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Escapes text used inside an attribute value or element content. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Chinese message for a range violation, with the bound spelled out. */
function rangeMessage(kind: 'min' | 'max', bound: number): string {
  return kind === 'min' ? `数值不能小于 ${canonical(bound)}。` : `数值不能大于 ${canonical(bound)}。`;
}

/** Chinese message for a step violation. */
function stepMessage(step: number): string {
  return `数值必须符合步长 ${canonical(step)}。`;
}

/**
 * `<an-number>` — a numeric field backed by an internal `<input type="text"
 * inputmode="decimal" role="spinbutton">`, so typing, selection, IME and the
 * on-screen keyboard come from the platform.
 *
 * The text is a *draft*: `-`, `.`, `1.` and `1.2` are kept verbatim while the
 * user types and are only normalised (clamped, rounded by `precision`, trailing
 * zeros dropped) on blur or Enter. Constraint validation, however, is live.
 *
 * The host is form-associated: `disabled` removes the entry and the constraint
 * (like a native disabled control), `readonly` keeps the entry but is barred
 * from validation (like a native read-only control), and `required` is enforced
 * through `ElementInternals.setValidity()`.
 *
 * @attr {string} value - Initial numeric text. It seeds the field and is never written back; use the `value` property to read the parsed number. The property also accepts a number or a numeric string (framework templates pass `value="3"` through as a string).
 * @attr {number} min - Minimum accepted value. Values below it are normalised to it and flagged `rangeUnderflow` until then. No default.
 * @attr {number} max - Maximum accepted value. Values above it are normalised to it and flagged `rangeOverflow` until then. No default.
 * @attr {number} step - Stepping interval for the arrow keys, the stepper buttons and `stepUp()`/`stepDown()`. Default: 1.
 * @attr {number} precision - Decimal places applied when the text is committed; trailing zeros are always dropped. No default (keeps the natural decimals).
 * @attr {boolean} disabled - Disables the field, drops it from `FormData` and from constraint validation.
 * @attr {boolean} readonly - Makes the field read-only: it still submits but is barred from constraint validation and from stepping.
 * @attr {boolean} required - Fails constraint validation with `valueMissing` while the field is empty.
 * @attr {string} placeholder - Placeholder text forwarded to the internal input.
 * @attr {string} name - Name of the `FormData` entry.
 * @attr {('sm'|'md'|'lg')} size - Control size. Default: "md".
 * @attr {boolean} stepper - Renders the up/down spin buttons, which also repeat while held.
 * @fires {CustomEvent<AnNumberChangeDetail>} an-number-change - The parsed value changed, on commit, on a keyboard/stepper step, or when `stepUp()`/`stepDown()` move it. Never fires when the parsed value stays the same.
 * @slot - No slots are projected; the whole control is rendered in the shadow root.
 * @csspart base - The wrapper around the input and the optional stepper.
 * @csspart input - The internal text input.
 * @csspart stepper - The stepper wrapper, rendered only with `stepper`.
 * @csspart spin-up - The increment button.
 * @csspart spin-down - The decrement button.
 * @cssprop --an-number-height - Height of the field.
 * @cssprop --an-number-bg - Field background.
 * @cssprop --an-number-fg - Field text colour.
 * @cssprop --an-number-border-color - Field border colour.
 * @cssprop --an-number-radius - Field corner radius.
 * @cssprop --an-number-font-size - Field font size.
 * @cssprop --an-number-padding-x - Horizontal padding of the field.
 * @cssprop --an-number-focus-ring - Focus outline and border colour.
 * @cssprop --an-number-stepper-width - Width of the stepper column.
 */
export class AnNumber extends AnElement {
  static override styles: string = numberStyles;
  static override formAssociated = true;

  /**
   * `value` is deliberately not part of `defaults`: the base class reflects
   * every default property back onto its attribute, while this component must
   * never write `value` back (it is a seed). It is observed and exposed
   * manually below.
   *
   * `min`, `max` and `precision` keep the raw attribute text so "unset" stays
   * distinguishable from "zero"; the parsed numbers are read when needed.
   */
  static override defaults = {
    placeholder: '',
    min: '',
    max: '',
    step: 1,
    precision: '',
    size: 'md',
    disabled: false,
    readonly: false,
    required: false,
    stepper: false,
    name: '',
  };

  declare placeholder: string;
  declare min: string;
  declare max: string;
  declare step: number;
  declare precision: string;
  declare size: AnNumberSize;
  declare disabled: boolean;
  declare readonly: boolean;
  declare required: boolean;
  declare stepper: boolean;
  declare name: string;

  /** The text currently shown in the internal input (may be a draft). */
  #text = '';
  /** Text the element was mounted with; `formResetCallback` restores it. */
  #initialText = '';
  /** Last parsed value reported through `an-number-change`, for the change guard. */
  #reported: number | null = null;
  #mounted = false;
  /** Set by `formDisabledCallback` (e.g. a disabled ancestor `<fieldset>`). */
  #formDisabled = false;
  #holdDelay: ReturnType<typeof setTimeout> | null = null;
  #holdInterval: ReturnType<typeof setInterval> | null = null;

  /** `value` and the forwarded ARIA names are observed outside `defaults`. */
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'value', 'aria-label', 'aria-labelledby'];
  }

  constructor() {
    super();
    // Delegation on the shadow root survives the innerHTML re-render.
    const root = this.shadowRoot!;
    root.addEventListener('input', this.#onInput);
    root.addEventListener('change', this.#onChange);
    root.addEventListener('focusout', this.#onFocusOut);
    root.addEventListener('keydown', this.#onKeyDown);
    root.addEventListener('pointerdown', this.#onPointerDown);
    root.addEventListener('click', this.#onClick);
  }

  /**
   * Parsed current value; `null` while the field is empty or not a number.
   *
   * Assigning accepts a number or a numeric string (framework templates pass
   * `value="3.5"` through as a string property, which must not blank the
   * field). `null`, `undefined`, blank text and non-finite input clear it.
   */
  get value(): number | null {
    return this.#number();
  }

  /**
   * Sets the displayed text; never emits `an-number-change`.
   *
   * Accepts a number or a numeric string, because framework templates hand
   * `value="3.5"` over as a string property and a number-only setter would
   * silently clear the field. `null`, `undefined`, an empty or blank string and
   * anything that does not parse to a finite number clear the field; it never
   * throws.
   */
  set value(next: number | string | null) {
    if (next == null) {
      this.#setText('');
    } else if (typeof next === 'number') {
      this.#setText(Number.isFinite(next) ? canonical(next) : '');
    } else if (next.trim() === '') {
      this.#setText('');
    } else {
      const numeric = Number(next.trim());
      this.#setText(Number.isFinite(numeric) ? canonical(numeric) : '');
    }
    this.#reported = this.#number();
  }

  /** Steps the value up by `step * n`, snapping onto the `min`-based grid. */
  stepUp(n = 1): void {
    this.#applyStep(1, n, new Event('change'));
  }

  /** Steps the value down by `step * n`, snapping onto the `min`-based grid. */
  stepDown(n = 1): void {
    this.#applyStep(-1, n, new Event('change'));
  }

  /** The attribute seeds the value; it is never written back by the property. */
  override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (name === 'value') {
      if (oldValue !== value) {
        this.#setText(value ?? '');
        this.#reported = this.#number();
      }
      return;
    }
    if (name === 'aria-label' || name === 'aria-labelledby') {
      // Forwarded to the internal input; the host has no accessible name of its own.
      if (oldValue !== value) this.requestUpdate();
      return;
    }
    super.attributeChangedCallback(name, oldValue, value);
  }

  protected override render(): string {
    const disabled = this.disabled || this.#formDisabled;
    const value = this.#number();
    const min = this.#bound('min');
    const max = this.#bound('max');
    const attrs =
      ' class="input" part="input" type="text" inputmode="decimal" role="spinbutton"' +
      ' autocomplete="off" spellcheck="false"' +
      (this.placeholder ? ` placeholder="${escapeHtml(this.placeholder)}"` : '') +
      (disabled ? ' disabled aria-disabled="true"' : '') +
      (this.readonly ? ' readonly aria-readonly="true"' : '') +
      (this.required ? ' required aria-required="true"' : '') +
      (min !== null ? ` aria-valuemin="${canonical(min)}"` : '') +
      (max !== null ? ` aria-valuemax="${canonical(max)}"` : '') +
      (value !== null ? ` aria-valuenow="${canonical(value)}"` : '') +
      (this.#text !== '' ? ` aria-valuetext="${escapeHtml(this.#text)}"` : '') +
      this.#forwardedName();
    const stepper = this.stepper ? this.#renderStepper(disabled) : '';
    return `<div class="base" part="base"><input${attrs}>${stepper}</div>`;
  }

  protected override afterRender(): void {
    this.#applyText();
    const internals = this.internals;
    if (!internals) return;
    const disabled = this.disabled || this.#formDisabled;
    internals.ariaDisabled = disabled ? 'true' : null;
    internals.ariaReadOnly = this.readonly ? 'true' : null;
    internals.ariaRequired = this.required ? 'true' : null;
    this.#syncForm();
  }

  /** Remembers the text the element was mounted with (the reset target). */
  protected override onConnect(): void {
    if (this.#mounted) return;
    this.#mounted = true;
    this.#initialText = this.#text;
    this.#reported = this.#number();
  }

  protected override onDisconnect(): void {
    this.#stopHold();
  }

  protected override onFormReset(): void {
    this.#setText(this.#initialText);
    this.#reported = this.#number();
    this.#syncForm();
  }

  /** Mirrors a platform-level disable (e.g. an ancestor `<fieldset disabled>`). */
  protected override onFormDisabled(disabled: boolean): void {
    this.#formDisabled = disabled;
    if (disabled) this.#stopHold();
    this.requestUpdate();
    this.#syncForm();
  }

  /**
   * Rows this element contributes to `FormData`: the normalised value, or an
   * empty string when the field is empty (like a native text input). Disabled
   * controls contribute nothing, exactly like a native `<input disabled>`.
   */
  protected override formEntries(): Array<[string, string | File]> {
    if (this.name === '' || this.disabled || this.#formDisabled) return [];
    return [[this.name, this.#submittable()]];
  }

  /** `aria-label` / `aria-labelledby` forwarded to the internal input. */
  #forwardedName(): string {
    const label = this.getAttribute('aria-label');
    const labelledBy = this.getAttribute('aria-labelledby');
    return (
      (label ? ` aria-label="${escapeHtml(label)}"` : '') +
      (labelledBy ? ` aria-labelledby="${escapeHtml(labelledBy)}"` : '')
    );
  }

  #renderStepper(disabled: boolean): string {
    const inert = disabled || this.readonly;
    return (
      '<span class="stepper" part="stepper">' +
      `<button type="button" class="spin spin-up" part="spin-up" data-step="1" aria-label="增加"${
        inert ? ' disabled' : ''
      }>▲</button>` +
      `<button type="button" class="spin spin-down" part="spin-down" data-step="-1" aria-label="减少"${
        inert ? ' disabled' : ''
      }>▼</button>` +
      '</span>'
    );
  }

  /** The parsed value, or `null` when the draft is not a finite number. */
  #number(): number | null {
    return parseNumber(this.#text);
  }

  /** Parsed `min` / `max`, or `null` when unset or not a number. */
  #bound(name: 'min' | 'max'): number | null {
    const raw = (name === 'min' ? this.min : this.max).trim();
    if (raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  /** The stepping interval; invalid or non-positive values fall back to `1`. */
  #step(): number {
    const step = Number(this.step);
    return Number.isFinite(step) && step > 0 ? step : 1;
  }

  /** Decimal places from `precision`, or `null` when unset. */
  #precision(): number | null {
    const raw = this.precision.trim();
    if (raw === '') return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.min(20, Math.trunc(value)));
  }

  /** Rounds through `precision` when set, otherwise only kills float noise. */
  #round(value: number): number {
    const precision = this.#precision();
    if (precision !== null) return roundTo(value, precision);
    return Number.isFinite(value) ? Number(value.toFixed(10)) : value;
  }

  /** Clamps to `min` / `max`. */
  #clamp(value: number): number {
    const min = this.#bound('min');
    const max = this.#bound('max');
    let next = value;
    if (min !== null && next < min) next = min;
    if (max !== null && next > max) next = max;
    return next;
  }

  /** The string submitted to the owning form. */
  #submittable(): string {
    const value = this.#number();
    return value === null ? '' : canonical(value);
  }

  /** The current constraint state, in the order the messages are prioritised. */
  #validation(): NumberValidation {
    const text = this.#text.trim();
    const value = this.#number();
    const min = this.#bound('min');
    const max = this.#bound('max');
    const step = this.#step();

    if (this.required && text === '') {
      return { flags: { valueMissing: true }, message: REQUIRED_MESSAGE, invalid: true };
    }
    if (value === null) {
      if (text === '') return { flags: {}, message: '', invalid: false };
      return { flags: { badInput: true }, message: BAD_INPUT_MESSAGE, invalid: true };
    }
    if (min !== null && value < min) {
      return { flags: { rangeUnderflow: true }, message: rangeMessage('min', min), invalid: true };
    }
    if (max !== null && value > max) {
      return { flags: { rangeOverflow: true }, message: rangeMessage('max', max), invalid: true };
    }
    const base = min ?? 0;
    const quotient = (value - base) / step;
    if (Math.abs(quotient - Math.round(quotient)) > 1e-9) {
      return { flags: { stepMismatch: true }, message: stepMessage(step), invalid: true };
    }
    return { flags: {}, message: '', invalid: false };
  }

  /**
   * Publishes the value and the constraint to the owning form.
   *
   * A disabled control is *barred from constraint validation* and contributes no
   * entry, exactly like a native `<input disabled>`. A read-only control still
   * contributes its value (a native `<input readonly>` is never excluded from
   * `FormData`), but it is barred from validation.
   */
  #syncForm(): void {
    const internals = this.internals;
    if (!internals) return;
    const input = this.#input;
    if (this.disabled || this.#formDisabled) {
      this.#stopHold();
      internals.setFormValue(null);
      internals.setValidity({});
      internals.ariaInvalid = null;
      input?.removeAttribute('aria-invalid');
      this.#syncAria();
      return;
    }
    // A read-only field can still submit, but it must not keep stepping under a held button.
    if (this.readonly) this.#stopHold();
    internals.setFormValue(this.#submittable());
    const state: NumberValidation = this.readonly
      ? { flags: {}, message: '', invalid: false }
      : this.#validation();
    internals.setValidity(state.flags, state.message, input ?? undefined);
    internals.ariaInvalid = state.invalid ? 'true' : null;
    if (state.invalid) input?.setAttribute('aria-invalid', 'true');
    else input?.removeAttribute('aria-invalid');
    this.#syncAria();
  }

  /** Keeps the spinbutton ARIA values in step with the draft text. */
  #syncAria(): void {
    const input = this.#input;
    if (!input) return;
    const value = this.#number();
    const min = this.#bound('min');
    const max = this.#bound('max');
    const set = (name: string, next: string | null): void => {
      if (next === null) input.removeAttribute(name);
      else input.setAttribute(name, next);
    };
    set('aria-valuenow', value === null ? null : canonical(value));
    set('aria-valuemin', min === null ? null : canonical(min));
    set('aria-valuemax', max === null ? null : canonical(max));
    set('aria-valuetext', this.#text === '' ? null : this.#text);
  }

  /** Stores the draft text, writes it into the live input and re-publishes state. */
  #setText(next: string): void {
    this.#text = next;
    this.#applyText();
    this.#syncForm();
  }

  /** Writes the draft into the live input, keeping the caret where it was. */
  #applyText(): void {
    const input = this.#input;
    if (!input || input.value === this.#text) return;
    const focused = this.shadowRoot?.activeElement === input;
    let caret = this.#text.length;
    if (focused) {
      try {
        caret = input.selectionStart ?? caret;
      } catch {
        // Selection is not available for every input mode; fall back to the end.
      }
    }
    input.value = this.#text;
    if (!focused) return;
    const position = Math.min(caret, this.#text.length);
    try {
      input.setSelectionRange(position, position);
    } catch {
      // Selection is not available for every input mode; fall back to the end.
    }
  }

  /**
   * Normalises a committed draft: clamp to the bounds, round through
   * `precision` and drop trailing zeros. Text that is not a number is left
   * verbatim so `badInput` stays visible.
   */
  #normalize(): void {
    const value = this.#number();
    if (value === null) return;
    let next = this.#round(value);
    next = this.#clamp(next);
    next = this.#round(next);
    this.#setText(canonical(next));
  }

  /** Dispatches `an-number-change` when the parsed value actually changed. */
  #announce(originalEvent: Event): void {
    const value = this.#number();
    if (value === this.#reported) return;
    this.#reported = value;
    this.emit<AnNumberChangeDetail>('an-number-change', { value, originalEvent });
  }

  /** Commits on blur/Enter: normalise, refresh the form state, then announce. */
  #commit(originalEvent: Event): void {
    if (this.disabled || this.readonly || this.#formDisabled) return;
    this.#normalize();
    this.#syncForm();
    this.#announce(originalEvent);
  }

  /**
   * Steps onto the grid based at `min` (or `0`), then clamps and rounds. A
   * draft that is not on the grid snaps to the next grid point in the stepping
   * direction before the step is applied.
   */
  #applyStep(direction: 1 | -1, count: number, originalEvent: Event): void {
    if (this.disabled || this.readonly || this.#formDisabled) return;
    const steps = Number.isFinite(count) ? Math.abs(count) : 1;
    if (steps === 0) return;

    const step = this.#step();
    const base = this.#bound('min') ?? 0;
    const start = this.#number() ?? base;
    const relative = (start - base) / step;
    const epsilon = 1e-9;
    const index =
      direction === 1
        ? Math.floor(relative + epsilon) + steps
        : Math.ceil(relative - epsilon) - steps;
    let next = base + index * step;
    next = this.#round(next);
    next = this.#clamp(next);
    next = this.#round(next);

    this.#setText(canonical(next));
    this.#announce(originalEvent);
  }

  /** Moves straight to a bound (Home / End), then clamps and rounds. */
  #jumpTo(bound: number, originalEvent: Event): void {
    if (this.disabled || this.readonly || this.#formDisabled) return;
    let next = this.#round(bound);
    next = this.#clamp(next);
    next = this.#round(next);
    this.#setText(canonical(next));
    this.#announce(originalEvent);
  }

  #onInput = (event: Event): void => {
    const input = this.#input;
    if (!input || event.target !== input) return;
    if (this.disabled || this.readonly || this.#formDisabled) return;
    // Keep the draft verbatim; parsing and validation read it, but nothing rewrites it here.
    this.#text = input.value;
    this.#syncForm();
  };

  #onChange = (event: Event): void => {
    if (event.target !== this.#input) return;
    this.#commit(event);
  };

  #onFocusOut = (event: Event): void => {
    if (event.target !== this.#input) return;
    this.#commit(event);
  };

  #onKeyDown = (event: Event): void => {
    const input = this.#input;
    if (!input || event.target !== input) return;
    if (this.disabled || this.readonly || this.#formDisabled) return;
    const keyboard = event as KeyboardEvent;
    switch (keyboard.key) {
      case 'ArrowUp':
        keyboard.preventDefault();
        this.#applyStep(1, keyboard.shiftKey ? 10 : 1, event);
        return;
      case 'ArrowDown':
        keyboard.preventDefault();
        this.#applyStep(-1, keyboard.shiftKey ? 10 : 1, event);
        return;
      case 'PageUp':
        keyboard.preventDefault();
        this.#applyStep(1, 10, event);
        return;
      case 'PageDown':
        keyboard.preventDefault();
        this.#applyStep(-1, 10, event);
        return;
      case 'Home': {
        const min = this.#bound('min');
        if (min === null) return;
        keyboard.preventDefault();
        this.#jumpTo(min, event);
        return;
      }
      case 'End': {
        const max = this.#bound('max');
        if (max === null) return;
        keyboard.preventDefault();
        this.#jumpTo(max, event);
        return;
      }
      case 'Enter':
        this.#commit(event);
        return;
      default:
        return;
    }
  };

  #stepDirection(event: Event): 1 | -1 | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const button = target.closest('[data-step]');
    if (!button) return null;
    return button.getAttribute('data-step') === '-1' ? -1 : 1;
  }

  #onPointerDown = (event: Event): void => {
    const direction = this.#stepDirection(event);
    if (direction === null) return;
    if (this.disabled || this.readonly || this.#formDisabled) return;
    this.#startHold(direction, event);
  };

  #onClick = (event: Event): void => {
    // A pointer click already stepped on `pointerdown`; only keyboard/AT activations reach here.
    if ((event as MouseEvent).detail !== 0) return;
    const direction = this.#stepDirection(event);
    if (direction === null) return;
    this.#applyStep(direction, 1, event);
  };

  /** Steps once, then continues stepping while the button stays down. */
  #startHold(direction: 1 | -1, originalEvent: Event): void {
    this.#stopHold();
    this.#applyStep(direction, 1, originalEvent);
    this.#holdDelay = setTimeout(() => {
      this.#holdDelay = null;
      this.#holdInterval = setInterval(
        () => this.#applyStep(direction, 1, originalEvent),
        STEP_REPEAT_INTERVAL,
      );
    }, STEP_HOLD_DELAY);
    this.ownerDocument.addEventListener('pointerup', this.#onPointerUp);
    this.ownerDocument.addEventListener('pointercancel', this.#onPointerUp);
  }

  #onPointerUp = (): void => {
    this.#stopHold();
  };

  /** Clears the hold timers and their document-level listeners. */
  #stopHold(): void {
    if (this.#holdDelay !== null) {
      clearTimeout(this.#holdDelay);
      this.#holdDelay = null;
    }
    if (this.#holdInterval !== null) {
      clearInterval(this.#holdInterval);
      this.#holdInterval = null;
    }
    this.ownerDocument?.removeEventListener('pointerup', this.#onPointerUp);
    this.ownerDocument?.removeEventListener('pointercancel', this.#onPointerUp);
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
