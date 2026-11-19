import groupStyles from './an-checkbox-group.css?inline';
import { AnElement } from '../internal/base';
import type { AnCheckbox, AnCheckboxChangeDetail } from '../checkbox/an-checkbox';

/** Payload of `an-checkbox-group-change`. */
export interface AnCheckboxGroupEventDetail {
  /** Values selected after the change, in DOM order. */
  value: string[];
  /** The click / keyboard event that triggered the change. */
  originalEvent: Event;
}

/** Shown when `required` is set and nothing is selected. */
const REQUIRED_MESSAGE = '请至少选择一个选项';

/** `&` -> `&amp;`, so attribute text can never break out of the markup. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** True once the child has been upgraded into `AnCheckbox` (its accessors exist). */
function isUpgraded(checkbox: AnCheckbox): boolean {
  return typeof (checkbox as unknown as { checked?: unknown }).checked === 'boolean';
}

/** Same ordered list, or not. */
function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * `<an-checkbox-group>` — form-associated container for a set of
 * `<an-checkbox>` options.
 *
 * The group owns the selection, the form entry and the constraint validation;
 * each child is a dumb control that only renders a native
 * `<input type="checkbox">`. Children report a toggle with
 * `an-checkbox-change`, after which the group writes their `checked` /
 * `disabled` / roving-tab state back.
 *
 * The native inputs live in separate shadow roots, so the platform cannot tab
 * between them: the group keeps exactly one enabled child tabbable and moves
 * focus with the arrow keys (Home / End jump to the ends). Space toggles the
 * focused child, exactly like a native checkbox.
 *
 * @attr {string} name - Form field name; each selected value is submitted under it.
 * @attr {string} value - Comma-separated selected values (`value="a,b"`); reflected by `.value`.
 * @attr {boolean} disabled - Disables the whole group, including every child.
 * @attr {boolean} required - Requires at least one selection for form submission.
 * @attr {string} label - Visible label of the group; also names the `group` for assistive tech.
 * @attr {('vertical'|'horizontal')} orientation - Stacking direction of the options. Default: "vertical".
 * @attr {number} min - Minimum number of selected options; `0` disables the check.
 * @attr {number} max - Maximum number of selected options; `0` means unlimited.
 * @fires an-checkbox-group-change - Fired when the selection changes; `detail = { value, originalEvent }`.
 * @slot - The `<an-checkbox>` options.
 * @csspart base - Outer wrapper around the label and the options.
 * @csspart label - The visible group label; rendered only when `label` is non-empty.
 * @csspart group - The `role="group"` container holding the options.
 * @cssprop --an-checkbox-group-gap - Gap between options; defaults to `--an-space-2` (0.5rem).
 */
export class AnCheckboxGroup extends AnElement {
  static override formAssociated = true;

  static override styles: string = groupStyles;

  static override defaults = {
    name: '',
    label: '',
    disabled: false,
    required: false,
    orientation: 'vertical',
    min: 0,
    max: 0,
  };

  static override arrayDefaults = {
    value: [] as string[],
  };

  /** Form field name; every selected value is submitted under it. */
  declare name: string;
  /** Visible label of the group; also names the `group` for assistive tech. */
  declare label: string;
  /** Disables the whole group, including every child checkbox. */
  declare disabled: boolean;
  /** Requires at least one selected option for form submission. */
  declare required: boolean;
  /** Stacking direction of the options. */
  declare orientation: 'vertical' | 'horizontal';
  /** Minimum number of selected options; `0` disables the check. */
  declare min: number;
  /** Maximum number of selected options; `0` means unlimited. */
  declare max: number;
  /** Selected values, comma-separated in the `value` attribute. */
  declare value: string[];

  /** A platform-level disable (e.g. an ancestor `<fieldset disabled>`). */
  #formDisabled = false;

  /** Selection at mount, restored by `reset()`. */
  #initialValue: string[] = [];

  /** The initial selection is already latched. */
  #captured = false;

  /** The deferred initial-state capture is already queued. */
  #captureScheduled = false;

  /** Child that owns the single roving tab stop. */
  #roving: AnCheckbox | null = null;

  /** A child's own disabled state, kept apart from the group-imposed one. */
  #intrinsicDisabled = new WeakMap<AnCheckbox, boolean>();

  /** The value this group last wrote to `checkbox.disabled`. */
  #appliedDisabled = new WeakMap<AnCheckbox, boolean>();

  constructor() {
    super();
    const root = this.shadowRoot!;
    root.addEventListener('slotchange', this.#onSlotChange);
    // `keydown`, `focusin` and the checkbox's own event are composed, so they
    // reach the host; delegation keeps working across every re-render.
    this.addEventListener('keydown', this.#onKeydown);
    this.addEventListener('focusin', this.#onFocusIn);
    this.addEventListener('an-checkbox-change', this.#onCheckboxChange);
  }

  protected render(): string {
    const label = this.label;
    // A visible label names the group from inside the shadow root; otherwise the
    // consumer-provided ARIA name is forwarded.
    const name = label ? ' aria-labelledby="group-label"' : this.#forwardedName();
    return (
      `<div class="base" part="base">` +
      (label
        ? `<span class="label" part="label" id="group-label">${escapeHtml(label)}</span>`
        : '') +
      `<div class="group" part="group" role="group"` +
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
    // Children connect (and render their inner inputs) after this callback, so
    // re-assert once the whole tree is upgraded: the roving tabindex can only be
    // written when the shadow inputs exist.
    queueMicrotask(() => {
      if (this.isConnected) this.#syncChildren();
    });
  }

  protected override onFormReset(): void {
    this.value = [...this.#initialValue];
    this.requestUpdate();
    // The checkbox children are form-associated too, so the platform resets each
    // of them to its own mounted state right after this callback. Re-assert the
    // group selection once every reset callback has run.
    queueMicrotask(() => {
      if (this.isConnected) this.#syncChildren();
    });
  }

  /** Mirrors a platform-level disable (e.g. an ancestor `<fieldset disabled>`). */
  protected override onFormDisabled(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.requestUpdate();
  }

  /**
   * One row per selected value, all under the same `name`. `getFormData()`
   * therefore appends several entries for a multi-value selection.
   */
  protected override formEntries(): Array<[string, string | File]> {
    if (this.disabled || this.#formDisabled || !this.name) return [];
    return this.#selectedValues().map((value): [string, string] => [this.name, value]);
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

  /**
   * The `<an-checkbox>` options directly owned by this group, in DOM order.
   * Nested groups keep their own options, so the search stops at the first
   * level.
   */
  #checkboxes(): AnCheckbox[] {
    return Array.from(this.children).filter(
      (child) => child.localName === 'an-checkbox',
    ) as unknown as AnCheckbox[];
  }

  /** Enabled options, the candidates for focus and arrow navigation. */
  #enabled(): AnCheckbox[] {
    return this.#checkboxes().filter((checkbox) => !checkbox.disabled);
  }

  /** Selected values that match an option, in DOM order, without duplicates. */
  #selectedValues(): string[] {
    const selected = new Set(this.value);
    const values: string[] = [];
    for (const checkbox of this.#checkboxes()) {
      if (!selected.has(checkbox.value) || values.includes(checkbox.value)) continue;
      values.push(checkbox.value);
    }
    return values;
  }

  /** Pushes the group state down onto every option. */
  #syncChildren(): void {
    const checkboxes = this.#checkboxes();
    // An explicit value needs no deferred adoption, so the reset target can be
    // latched synchronously — `form.reset()` may run before the microtask does.
    if (
      !this.#captured &&
      this.value.length > 0 &&
      checkboxes.length > 0 &&
      checkboxes.every(isUpgraded)
    ) {
      this.#initialValue = [...this.value];
      this.#captured = true;
    }
    const groupDisabled = this.disabled || this.#formDisabled;
    for (const checkbox of checkboxes) {
      // Before the initial state is captured, an empty value leaves the options
      // alone: a `checked` option in markup is the seed for the group value.
      if (this.#captured) {
        const selected = this.value.includes(checkbox.value);
        if (checkbox.checked !== selected) checkbox.checked = selected;
      }
      this.#applyDisabled(checkbox, groupDisabled);
    }
    this.#applyRoving(checkboxes);
    this.#scheduleCapture();
    this.#syncForm();
  }

  /** Applies the group-imposed disable without losing a child's own state. */
  #applyDisabled(checkbox: AnCheckbox, groupDisabled: boolean): void {
    const applied = this.#appliedDisabled.get(checkbox);
    const current = checkbox.disabled;
    if (applied !== undefined && current !== applied) {
      this.#intrinsicDisabled.set(checkbox, current);
    }
    const intrinsic = this.#intrinsicDisabled.get(checkbox) ?? current;
    const next = groupDisabled || intrinsic;
    if (current !== next) checkbox.disabled = next;
    this.#appliedDisabled.set(checkbox, next);
    this.#intrinsicDisabled.set(checkbox, intrinsic);
  }

  /** Keeps exactly one enabled option tabbable; the tab stop follows focus. */
  #applyRoving(checkboxes: AnCheckbox[]): void {
    const enabled = checkboxes.filter((checkbox) => !checkbox.disabled);
    let roving =
      this.#roving && enabled.includes(this.#roving) ? this.#roving : null;
    if (!roving) roving = enabled.find((checkbox) => checkbox.checked) ?? enabled[0] ?? null;
    this.#roving = roving;
    for (const checkbox of checkboxes) {
      const input = this.#inputOf(checkbox);
      if (!input) continue;
      const tabindex = checkbox === roving ? '0' : '-1';
      if (input.getAttribute('tabindex') !== tabindex) input.setAttribute('tabindex', tabindex);
    }
  }

  /** Moves focus (and the roving tab stop) onto one option. */
  #focusCheckbox(checkbox: AnCheckbox): void {
    this.#roving = checkbox;
    this.#applyRoving(this.#checkboxes());
    this.#inputOf(checkbox)?.focus({ preventScroll: true });
  }

  /**
   * Latches the reset target once every option exists and is upgraded. The
   * parser connects the host before its children, so this runs in a microtask
   * (and again when a late option reports a slot change).
   */
  #capture(): void {
    if (this.#captured) return;
    const checkboxes = this.#checkboxes();
    if (checkboxes.length === 0 || !checkboxes.every(isUpgraded)) return;
    const explicit = this.#selectedValues();
    const initial =
      explicit.length > 0
        ? explicit
        : checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
    this.#initialValue = [...initial];
    this.#captured = true;
    // A `checked` option in markup seeds the value when the attribute is absent.
    if (this.value.length === 0 && initial.length > 0) this.value = initial;
  }

  #scheduleCapture(): void {
    if (this.#captured || this.#captureScheduled) return;
    const checkboxes = this.#checkboxes();
    if (checkboxes.length === 0 || !checkboxes.every(isUpgraded)) return;
    this.#captureScheduled = true;
    queueMicrotask(() => {
      this.#captureScheduled = false;
      if (!this.isConnected) return;
      this.#capture();
      this.#syncChildren();
    });
  }

  /** Keeps the form entry and the constraint state in step with the value. */
  #syncForm(): void {
    const internals = this.internals;
    if (!internals) return;
    if (this.disabled || this.#formDisabled) {
      internals.setFormValue(null);
      internals.setValidity({});
      return;
    }
    const values = this.#selectedValues();
    // The platform entry list is a single slot; keep the attribute spelling and
    // let `getFormData()` expose one entry per value for `<an-form>`.
    internals.setFormValue(values.length > 0 ? values.join(',') : null);

    const anchor = this.#firstInput() ?? undefined;
    if (this.required && values.length === 0) {
      internals.setValidity({ valueMissing: true }, REQUIRED_MESSAGE, anchor);
    } else if (this.min > 0 && values.length < this.min) {
      internals.setValidity(
        { customError: true },
        `至少选择 ${this.min} 项`,
        anchor,
      );
    } else if (this.max > 0 && values.length > this.max) {
      internals.setValidity(
        { customError: true },
        `最多选择 ${this.max} 项`,
        anchor,
      );
    } else {
      internals.setValidity({});
    }
  }

  /** The first option's inner input, used as the focus target of the validity. */
  #firstInput(): HTMLInputElement | null {
    for (const checkbox of this.#checkboxes()) {
      const input = this.#inputOf(checkbox);
      if (input) return input;
    }
    return null;
  }

  /** The inner native input of one option, if it has rendered already. */
  #inputOf(checkbox: AnCheckbox): HTMLInputElement | null {
    return checkbox.shadowRoot?.querySelector('input') ?? null;
  }

  /** The `<an-checkbox>` child whose subtree emitted `event`, if any. */
  #checkboxFromEvent(event: Event): AnCheckbox | null {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      if (node instanceof HTMLElement && node.localName === 'an-checkbox' && node.parentElement === this) {
        return node as AnCheckbox;
      }
    }
    return null;
  }

  /** DOM order for known values; values without an option keep their order last. */
  #order(values: readonly string[]): string[] {
    const wanted = new Set(values);
    const ordered: string[] = [];
    for (const checkbox of this.#checkboxes()) {
      if (!wanted.has(checkbox.value) || ordered.includes(checkbox.value)) continue;
      ordered.push(checkbox.value);
    }
    for (const value of values) {
      if (!ordered.includes(value)) ordered.push(value);
    }
    return ordered;
  }

  /** Writes the new selection and announces it when it actually changed. */
  #commit(next: Iterable<string>, originalEvent: Event): void {
    const ordered = this.#order([...next]);
    if (sameList(ordered, this.value)) return;
    this.value = ordered;
    this.emit<AnCheckboxGroupEventDetail>('an-checkbox-group-change', {
      value: [...this.value],
      originalEvent,
    });
  }

  /** Toggles one option from a keyboard activation. */
  #toggle(checkbox: AnCheckbox, originalEvent: Event): void {
    if (this.disabled || this.#formDisabled || checkbox.disabled) return;
    const selected = new Set(this.value);
    if (selected.has(checkbox.value)) selected.delete(checkbox.value);
    else selected.add(checkbox.value);
    this.#commit(selected, originalEvent);
  }

  #onSlotChange = (): void => {
    this.#syncChildren();
  };

  #onCheckboxChange = (event: Event): void => {
    const checkbox = this.#checkboxFromEvent(event);
    if (!checkbox || !isUpgraded(checkbox)) return;
    if (this.disabled || this.#formDisabled) {
      const selected = this.value.includes(checkbox.value);
      if (checkbox.checked !== selected) checkbox.checked = selected;
      return;
    }
    const detail = (event as CustomEvent<AnCheckboxChangeDetail | undefined>).detail;
    const checked = detail?.checked ?? checkbox.checked;
    const selected = new Set(this.value);
    if (checked) selected.add(checkbox.value);
    else selected.delete(checkbox.value);
    this.#commit(selected, detail?.originalEvent ?? event);
  };

  #onFocusIn = (event: Event): void => {
    const checkbox = this.#checkboxFromEvent(event);
    if (!checkbox || checkbox.disabled) return;
    this.#roving = checkbox;
    this.#applyRoving(this.#checkboxes());
  };

  #onKeydown = (event: KeyboardEvent): void => {
    const checkbox = this.#checkboxFromEvent(event);
    if (!checkbox || checkbox.disabled) return;
    // Only the option itself (or its inner input) owns these keys; slotted
    // interactive content keeps its own keyboard behaviour.
    const focused = event.composedPath()[0];
    if (focused !== checkbox && focused !== this.#inputOf(checkbox)) return;

    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.#toggle(checkbox, event);
      return;
    }

    const enabled = this.#enabled();
    const index = enabled.indexOf(checkbox);
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
    this.#focusCheckbox(target);
  };

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
