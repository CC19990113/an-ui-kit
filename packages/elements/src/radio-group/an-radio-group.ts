import groupStyles from './an-radio-group.css?inline';
import { AnElement } from '../internal/base';
import type { AnRadio, AnRadioEventDetail } from '../radio/an-radio';

/** Payload of `an-radio-change`. */
export interface AnRadioGroupEventDetail {
  /** The value of the radio that is now selected. */
  value: string;
  /** The click / keyboard event that triggered the selection. */
  originalEvent: Event;
}

/** Shown to the owning form when `required` is set and nothing is selected. */
const REQUIRED_MESSAGE = '请选择一个选项';

/** `&` -> `&amp;`, so attribute text can never break out of the markup. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** True once the option has been upgraded into `AnRadio` (property accessors exist). */
function isUpgraded(radio: AnRadio): boolean {
  return typeof (radio as unknown as { tabbable?: unknown }).tabbable === 'boolean';
}

/**
 * `<an-radio-group>` — the form-associated half of the radio pair.
 *
 * The group owns the value, the form entry and validation; each child
 * `<an-radio>` is a dumb option that only renders a native `<input type="radio">`.
 * Child options register through `slotchange`, report a click / keyboard
 * activation with `an-radio-select`, and receive their `checked` / `disabled` /
 * roving-tab state back from the group.
 *
 * Native radios are grouped by tree root, and every `<an-radio>` keeps its input
 * in a separate shadow root, so the platform does **not** group them. Arrow-key
 * navigation is therefore implemented here: `keydown` is delegated from the
 * shadow root and the group moves (and selects) the next enabled option itself.
 *
 * @attr {string} name - Field name used when the value is submitted with the owning form.
 * @attr {string} value - Selected value, seeded by the attribute but never written back by the property.
 * @attr {string} label - Visible label, also used to name the `radiogroup` for assistive technology.
 * @attr {boolean} disabled - Disables every option and clears the form entry and validity.
 * @attr {boolean} required - Participates in constraint validation (`valueMissing` when nothing is selected).
 * @fires an-radio-change - Fired when the selection changes; `detail = { value, originalEvent }`.
 * @cssprop --an-radio-group-gap - Gap between options; defaults to `--an-space-3` (0.75rem).
 * @csspart base - Outer wrapper around the label and the options.
 * @csspart label - The visible group label; rendered only when `label` is non-empty.
 * @csspart group - The `role="radiogroup"` container holding the options.
 */
export class AnRadioGroup extends AnElement {
  static override formAssociated = true;

  static override styles = groupStyles;

  static override defaults = {
    name: '',
    label: '',
    disabled: false,
    required: false,
  };

  /** Form field name. */
  declare name: string;
  /** Visible label of the group; also names the `radiogroup` for assistive tech. */
  declare label: string;
  /** Disables the whole group, including every child radio. */
  declare disabled: boolean;
  /** Requires a selection for form submission. */
  declare required: boolean;

  /**
   * Selected value. Deliberately **not** attribute-backed: the selection is
   * runtime state, so assigning `.value` must not rewrite the `value` attribute.
   */
  #value = '';

  /** Selection at mount, restored by `form.reset()`. */
  #initialValue = '';

  /**
   * Latches the reset target the first time options exist. The parser connects
   * the host before its children are parsed, so this can not happen in
   * `connectedCallback`.
   */
  #captured = false;

  /** Set by `formDisabledCallback` (e.g. a disabled ancestor `<fieldset>`). */
  #formDisabled = false;

  /** A child's own disabled state, kept apart from the group-imposed one. */
  #intrinsicDisabled = new WeakMap<AnRadio, boolean>();

  /** The value this group last wrote to `radio.disabled`. */
  #appliedDisabled = new WeakMap<AnRadio, boolean>();

  /** Deferred initial-state capture is already queued. */
  #captureScheduled = false;

  /** `value` and the forwarded ARIA names are observed outside `defaults`. */
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'value', 'aria-label', 'aria-labelledby'];
  }

  constructor() {
    super();
    const root = this.shadowRoot!;
    root.addEventListener('slotchange', this.#onSlotChange);
    // `keydown` and the radio's internal event are composed, so they reach the
    // host; delegation keeps working across the group's own re-renders.
    this.addEventListener('keydown', this.#onKeydown);
    this.addEventListener('an-radio-select', this.#onRadioSelect);
    // An option that upgrades after the group tells it to re-sync.
    this.addEventListener('an-radio-connect', this.#onRadioConnect);
  }

  get value(): string {
    return this.#value;
  }

  set value(next: string | null) {
    this.#setValue(next === null || next === undefined ? '' : String(next));
  }

  /** The attribute seeds the value; it is never written back by the property. */
  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    value: string | null,
  ): void {
    if (name === 'value') {
      if (oldValue !== value) this.#setValue(value ?? '');
      return;
    }
    if (name === 'aria-label' || name === 'aria-labelledby') {
      if (oldValue !== value) this.requestUpdate();
      return;
    }
    super.attributeChangedCallback(name, oldValue, value);
  }

  protected render(): string {
    const label = this.label;
    // A visible label names the group from inside the shadow root; otherwise the
    // consumer-provided ARIA name is forwarded.
    const name = label
      ? ' aria-labelledby="group-label"'
      : this.#forwardedName();
    return (
      `<div class="base" part="base">` +
      (label
        ? `<span class="label" part="label" id="group-label">${escapeHtml(label)}</span>`
        : '') +
      `<div class="group" part="group" role="radiogroup"` +
      ` aria-required="${this.required}"${name}><slot></slot></div>` +
      `</div>`
    );
  }

  protected override afterRender(): void {
    const internals = this.internals;
    if (internals) {
      internals.ariaDisabled = this.disabled || this.#formDisabled ? 'true' : null;
      internals.ariaRequired = this.required ? 'true' : null;
    }
    this.#syncChildren();
  }

  protected override onConnect(): void {
    // Children created by the parser may not exist yet while this runs; the
    // deferred capture below sees them even when no `slotchange` is emitted.
    this.#syncChildren();
  }

  protected override onFormReset(): void {
    this.#value = this.#initialValue;
    this.requestUpdate();
    this.#syncChildren();
  }

  protected override formEntries(): Array<[string, string]> {
    if (this.disabled || this.#formDisabled || !this.name || this.#value === '') return [];
    const selected = this.#radios().some(
      (radio) => radio.value === this.#value && !radio.disabled,
    );
    return selected ? [[this.name, this.#value]] : [];
  }

  /** Mirrors a platform-level disable (e.g. ancestor `<fieldset disabled>`). */
  protected override onFormDisabled(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.requestUpdate();
  }

  #setValue(next: string): void {
    if (next === this.#value) return;
    this.#value = next;
    this.requestUpdate();
  }

  /**
   * The `<an-radio>` options directly owned by this group, in DOM order. Nested
   * groups keep their own options, so the search stops at the first level.
   */
  #radios(): AnRadio[] {
    return Array.from(this.children).filter(
      (child) => child.localName === 'an-radio',
    ) as unknown as AnRadio[];
  }

  /** Pushes the group state down onto every option. */
  #syncChildren(): void {
    const radios = this.#radios();
    // An explicit value needs no deferred adoption, so the reset target can be
    // latched synchronously — `form.reset()` may run before the microtask does.
    if (
      !this.#captured &&
      this.#value !== '' &&
      radios.length > 0 &&
      radios.every(isUpgraded)
    ) {
      this.#initialValue = this.#value;
      this.#captured = true;
    }
    const groupDisabled = this.disabled || this.#formDisabled;
    for (const radio of radios) {
      // Before the initial state is captured, an empty value leaves the options
      // alone: a `checked` option in markup is the seed for the group value.
      if (this.#value !== '') {
        const selected = radio.value === this.#value;
        if (radio.checked !== selected) radio.checked = selected;
      } else if (this.#captured && radio.checked) {
        radio.checked = false;
      }
      this.#applyDisabled(radio, groupDisabled);
    }

    const enabled = radios.filter((radio) => !radio.disabled);
    const roving =
      enabled.find((radio) =>
        this.#value !== '' ? radio.value === this.#value : radio.checked,
      ) ??
      enabled[0] ??
      null;
    for (const radio of radios) {
      const tabbable = radio === roving;
      if (radio.tabbable !== tabbable) radio.tabbable = tabbable;
    }

    this.#scheduleCapture();
    this.#syncForm();
  }

  /**
   * Latches the reset target once every option exists and is upgraded. The
   * parser connects the host before its children, so this runs in a microtask
   * (and again when a late option reports `an-radio-connect`).
   */
  #capture(): void {
    if (this.#captured) return;
    const radios = this.#radios();
    if (radios.length === 0 || !radios.every(isUpgraded)) return;
    if (this.#value === '') {
      const checked = radios.find((radio) => radio.checked);
      if (checked) this.#value = checked.value;
    }
    this.#initialValue = this.#value;
    this.#captured = true;
  }

  #scheduleCapture(): void {
    if (this.#captured || this.#captureScheduled) return;
    const radios = this.#radios();
    if (radios.length === 0 || !radios.every(isUpgraded)) return;
    this.#captureScheduled = true;
    queueMicrotask(() => {
      this.#captureScheduled = false;
      if (!this.isConnected) return;
      this.#capture();
      this.#syncChildren();
    });
  }

  /**
   * Group disable wins, but a child that was disabled on its own stays disabled
   * once the group is re-enabled.
   */
  #applyDisabled(radio: AnRadio, groupDisabled: boolean): void {
    const applied = this.#appliedDisabled.get(radio);
    const current = radio.disabled;
    if (applied !== undefined && current !== applied) {
      this.#intrinsicDisabled.set(radio, current);
    }
    const intrinsic = this.#intrinsicDisabled.get(radio) ?? current;
    const next = groupDisabled || intrinsic;
    if (current !== next) radio.disabled = next;
    this.#appliedDisabled.set(radio, next);
    this.#intrinsicDisabled.set(radio, intrinsic);
  }

  /** Keeps `FormData`, validity and the required message in step with the value. */
  #syncForm(): void {
    const internals = this.internals;
    if (!internals) return;
    if (this.disabled || this.#formDisabled) {
      internals.setFormValue(null);
      internals.setValidity({});
      return;
    }
    // A value that matches no option is not a selection: it stays out of
    // FormData and keeps a required group invalid, like a native radio group.
    const selected =
      this.#value !== '' && this.#radios().some((radio) => radio.value === this.#value);
    internals.setFormValue(selected ? this.#value : null);
    if (this.required && !selected) {
      const anchor = this.#firstInput();
      internals.setValidity(
        { valueMissing: true },
        REQUIRED_MESSAGE,
        anchor ?? undefined,
      );
    } else {
      internals.setValidity({});
    }
  }

  /** The first option's inner input, used as the focus target of the validity. */
  #firstInput(): HTMLInputElement | null {
    for (const radio of this.#radios()) {
      const input = radio.shadowRoot?.querySelector('input');
      if (input) return input;
    }
    return null;
  }

  /** Selects `radio` and announces the change, unless nothing actually changed. */
  #selectRadio(radio: AnRadio, originalEvent: Event): void {
    if (this.disabled || this.#formDisabled || radio.disabled) return;
    const value = radio.value;
    if (value === this.#value) return;
    this.#value = value;
    this.#syncChildren();
    this.emit<AnRadioGroupEventDetail>('an-radio-change', { value, originalEvent });
  }

  /** The `<an-radio>` child whose subtree emitted `event`, if any. */
  #radioFromEvent(event: Event): AnRadio | null {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      if (node instanceof HTMLElement && node.localName === 'an-radio' && node.parentElement === this) {
        return node as AnRadio;
      }
    }
    return null;
  }

  #onSlotChange = (): void => {
    this.#syncChildren();
  };

  #onRadioConnect = (event: Event): void => {
    if (!this.#radioFromEvent(event)) return;
    this.#syncChildren();
  };

  #onRadioSelect = (event: Event): void => {
    const radio = this.#radioFromEvent(event);
    if (!radio) return;
    const detail = (event as CustomEvent<AnRadioEventDetail | undefined>).detail;
    this.#selectRadio(radio, detail?.originalEvent ?? event);
  };

  /**
   * Arrow-key navigation, implemented here because the native inputs live in
   * separate shadow roots and the platform never groups them. Home / End follow
   * the same roving-focus pattern.
   */
  #onKeydown = (event: KeyboardEvent): void => {
    const radio = this.#radioFromEvent(event);
    if (!radio || radio.disabled) return;

    const enabled = this.#radios().filter((candidate) => !candidate.disabled);
    const index = enabled.indexOf(radio);
    if (index === -1) return;

    let next = -1;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % enabled.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + enabled.length) % enabled.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = enabled.length - 1;
        break;
      default:
        return;
    }

    const target = enabled[next];
    if (!target) return;
    event.preventDefault();
    this.#selectRadio(target, event);
    target.focus();
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

  /** `aria-label` / `aria-labelledby` only when no visible group label exists. */
  #forwardedName(): string {
    const label = this.getAttribute('aria-label');
    const labelledby = this.getAttribute('aria-labelledby');
    return (
      (label ? ` aria-label="${escapeHtml(label)}"` : '') +
      (labelledby ? ` aria-labelledby="${escapeHtml(labelledby)}"` : '')
    );
  }
}
