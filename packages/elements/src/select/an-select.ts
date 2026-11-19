import selectStyles from './an-select.css?inline';
import { AnElement } from '../internal/base';

/** Control sizes of `<an-select>`. */
export type AnSelectSize = 'sm' | 'md' | 'lg';

const SIZES: readonly AnSelectSize[] = ['sm', 'md', 'lg'];

/** Shown to the owning form when `required` is set and nothing is selected. */
const REQUIRED_MESSAGE = '此字段为必填项。';

function oneOf<T extends string>(allowed: readonly T[], value: string, fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Escapes text used inside an attribute value or element content. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** One `<option>` mirrored from the light DOM into the shadow `<select>`. */
interface OptionSpec {
  value: string;
  text: string;
  selected: boolean;
  disabled: boolean;
  /** The synthetic `value=""` option rendered from `placeholder`. */
  placeholder: boolean;
}

/**
 * `<an-select>` — a select control backed by a real native `<select>` inside the
 * shadow root. Markup stays native: the author writes `<option>` children in the
 * light DOM and the element mirrors them into the shadow select, so option
 * semantics, keyboard interaction, mobile pickers and screen-reader behaviour
 * all come from the platform.
 *
 * ```html
 * <an-select name="city" label="城市" placeholder="请选择">
 *   <option value="bj">北京</option>
 *   <option value="sh">上海</option>
 * </an-select>
 * ```
 *
 * The light-DOM options are the source of truth and never render on the page
 * (`::slotted(option) { display: none }`). They are re-read on `slotchange` and
 * on light-DOM mutations, so adding, removing or reconfiguring an option at
 * runtime is reflected in the shadow select.
 *
 * The host is a form-associated custom element: the inner select lives across a
 * shadow boundary and is therefore not part of the outer `<form>`, so the host
 * registers its own entry instead (`ElementInternals.setFormValue()` /
 * `setValidity()`), exactly like `<an-input>`.
 *
 * `value` seeds the selection from its attribute but is never written back to
 * it: after mount the property and the inner select own the state.
 * `formResetCallback()` restores the value captured at mount time and
 * `formDisabledCallback()` mirrors a disabled ancestor `<fieldset>`.
 *
 * @attr {string} value - Initial selection. Never reflected back onto the attribute.
 * @attr {string} label - Visible label text; also names the control.
 * @attr {string} placeholder - When non-empty, prepends a disabled `value=""` option.
 * @attr {('sm'|'md'|'lg')} size - Control size. Default: "md".
 * @attr {boolean} disabled - Disables the inner select and bars validation.
 * @attr {boolean} required - Raises `valueMissing` while the value is empty.
 * @attr {boolean} invalid - Marks the control invalid with `aria-invalid="true"`.
 * @attr {string} name - Form field name used by `FormData`.
 *
 * @fires an-select-change - The user picked another option; `detail = { value, originalEvent }`.
 *
 * @csspart base - The wrapper around the control.
 * @csspart label - The visible `<label>`; rendered only when `label` is non-empty.
 * @csspart select - The internal native `<select>` element.
 * @csspart chevron - The decorative arrow drawn over the select.
 *
 * @cssprop --an-select-height - Control height; defaults to 2.25rem (2rem sm, 2.75rem lg).
 * @cssprop --an-select-bg - Control background; defaults to the `bg-1` token.
 * @cssprop --an-select-fg - Text and arrow colour; defaults to the `fg-1` token.
 * @cssprop --an-select-border-color - Border colour; defaults to the `border-1` token.
 * @cssprop --an-select-radius - Border radius; defaults to the `radius-md` token.
 * @cssprop --an-select-font-size - Text size; defaults to the `font-size-sm` token.
 * @cssprop --an-select-padding-x - Horizontal padding; defaults to the `space-3` token.
 * @cssprop --an-select-focus-ring - Focus outline colour; defaults to the `accent-9` token.
 */
export class AnSelect extends AnElement {
  static override styles: string = selectStyles;

  /** Opts the host into form participation so its value reaches the outer form. */
  static override formAssociated = true;

  /**
   * `value` is deliberately not part of `defaults`: the base class reflects
   * every default property back onto its attribute, while this component must
   * never write `value` back. It is observed and exposed manually below.
   */
  static override defaults = {
    label: '',
    placeholder: '',
    size: 'md',
    disabled: false,
    required: false,
    invalid: false,
    name: '',
  };

  declare label: string;
  declare placeholder: string;
  declare size: AnSelectSize;
  declare disabled: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare name: string;

  #value = '';
  /** Reset target, captured on the first sync that can describe the selection. */
  #initialValue = '';
  #initialCaptured = false;
  /**
   * True once the value is authoritative and must be re-applied on every
   * rebuild: either markup/property supplied it, or the mount-time default was
   * captured (see `#captureInitialValue`).
   */
  #valueSeeded = false;
  /** Set by `formDisabledCallback` (e.g. a disabled ancestor `<fieldset>`). */
  #formDisabled = false;
  /** Signature of the options mirrored into the shadow select last. */
  #signature = '';
  /** The select node the signature belongs to; a re-render replaces it. */
  #syncedSelect: HTMLSelectElement | null = null;
  #specs: OptionSpec[] = [];
  #observer: MutationObserver | null = null;

  /** `value` and the forwarded ARIA names are observed outside `defaults`. */
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'value', 'aria-label', 'aria-labelledby'];
  }

  constructor() {
    super();
    // Delegation on the shadow root survives the innerHTML re-render.
    this.shadowRoot!.addEventListener('change', this.#onChange);
    this.shadowRoot!.addEventListener('slotchange', this.#onSlotChange);
  }

  /** Current selection. Setting it moves the inner select without re-rendering. */
  get value(): string {
    return this.#value;
  }

  set value(next: string) {
    this.#setValue(next);
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
      // Forwarded to the inner select only while no visible label exists.
      if (oldValue !== value && !this.label) this.requestUpdate();
      return;
    }
    super.attributeChangedCallback(name, oldValue, value);
  }

  protected render(): string {
    const disabled = this.disabled || this.#formDisabled;
    const attrs =
      ` class="select" part="select"` +
      (disabled ? ' disabled aria-disabled="true"' : '') +
      (this.required ? ' required aria-required="true"' : '') +
      (this.invalid ? ' aria-invalid="true"' : '') +
      (this.label ? '' : this.#forwardedName());
    const select = `<select${attrs}></select>`;
    const control = `<span class="control">${select}<span class="chevron" part="chevron" aria-hidden="true"></span></span>`;
    return this.label
      ? `<div class="base" part="base"><label class="label" part="label"><span class="label-text">${escapeHtml(this.label)}</span>${control}</label><slot></slot></div>`
      : `<div class="base" part="base">${control}<slot></slot></div>`;
  }

  protected override afterRender(): void {
    this.#syncOptions();
    const internals = this.internals;
    if (!internals) return;
    const disabled = this.disabled || this.#formDisabled;
    internals.ariaDisabled = disabled ? 'true' : null;
    internals.ariaRequired = this.required ? 'true' : null;
    internals.ariaInvalid = this.invalid ? 'true' : null;
    this.#syncForm();
  }

  protected override onConnect(): void {
    this.#startObserving();
  }

  protected override onDisconnect(): void {
    this.#observer?.disconnect();
  }

  protected override onFormReset(): void {
    this.#valueSeeded = true;
    this.#value = this.#initialValue;
    this.#applyValue();
  }

  /** Mirrors a platform-level disable (e.g. ancestor `<fieldset disabled>`). */
  protected override onFormDisabled(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.requestUpdate();
  }

  #setValue(next: string | null | undefined): void {
    this.#valueSeeded = true;
    this.#value = next === null || next === undefined ? '' : String(next);
    this.#applyValue();
  }

  /** Reads the light-DOM `<option>` children, placeholder first. */
  #optionSpecs(): OptionSpec[] {
    const specs: OptionSpec[] = [];
    if (this.placeholder) {
      specs.push({
        value: '',
        text: this.placeholder,
        selected: true,
        disabled: true,
        placeholder: true,
      });
    }
    for (const child of Array.from(this.children)) {
      if (child.localName !== 'option') continue;
      const option = child as HTMLOptionElement;
      specs.push({
        value: option.value,
        text: option.textContent ?? '',
        selected: option.selected,
        disabled: option.disabled,
        placeholder: false,
      });
    }
    return specs;
  }

  /**
   * Mirrors the light-DOM options into the shadow select.
   *
   * A signature check keeps this cheap and, more importantly, keeps it from
   * looping: `slotchange` fires once per re-render, and only a real difference
   * in the option list rebuilds the shadow nodes.
   */
  #syncOptions(): void {
    const select = this.#select;
    if (!select) return;
    const specs = this.#optionSpecs();
    const signature = JSON.stringify(specs);
    if (select !== this.#syncedSelect || signature !== this.#signature) {
      this.#signature = signature;
      this.#syncedSelect = select;
      this.#fill(select, specs);
    }
    this.#specs = specs;
    this.#applyValue();
  }

  #fill(select: HTMLSelectElement, specs: readonly OptionSpec[]): void {
    select.innerHTML = '';
    for (const spec of specs) {
      const option = document.createElement('option');
      option.value = spec.value;
      option.textContent = spec.text;
      option.disabled = spec.disabled;
      option.selected = spec.selected;
      if (spec.placeholder) option.className = 'placeholder';
      select.append(option);
    }
  }

  /** The option the platform would pick with no explicit value: last `selected`, else the first. */
  #defaultValue(): string {
    for (let index = this.#specs.length - 1; index >= 0; index -= 1) {
      if (this.#specs[index].selected) return this.#specs[index].value;
    }
    return this.#specs.length > 0 ? this.#specs[0].value : '';
  }

  /**
   * Pushes the stored value into the inner select and adopts the platform's
   * answer, so the property always describes what is actually selected.
   *
   * A parser-created element can connect before its `<option>` children are
   * parsed. An empty select cannot represent a selection, so the echo is only
   * adopted once the option list exists; otherwise a value seeded from markup
   * would be wiped on the first sync.
   */
  #applyValue(): void {
    const select = this.#select;
    if (!select) return;
    if (this.#valueSeeded) {
      select.value = this.#value;
      if (this.#specs.length > 0) this.#value = select.value;
    } else {
      this.#value = this.#defaultValue();
      select.value = this.#value;
    }
    this.#captureInitialValue();
    this.#syncForm();
  }

  /**
   * Remembers the selection the element was mounted with (the reset target).
   *
   * Captured on the first sync that can describe it: either options are present
   * or markup supplied a value. Waiting for the options keeps a parser-created
   * element (children arrive after `connectedCallback`) from pinning `''`.
   *
   * Capturing freezes the value too: from then on a rebuild re-applies what was
   * selected, so removing that option leaves the control empty instead of
   * silently jumping to the new first option.
   */
  #captureInitialValue(): void {
    if (this.#initialCaptured) return;
    if (this.#specs.length === 0 && !this.#valueSeeded) return;
    this.#initialValue = this.#value;
    this.#initialCaptured = true;
    this.#valueSeeded = true;
  }

  /**
   * Publishes the value and the constraint to the owning form.
   *
   * An empty selection contributes no entry (native select parity), and a
   * disabled control is *barred from constraint validation*: it submits nothing
   * and never blocks the outer form, exactly like `<select disabled>`.
   */
  #syncForm(): void {
    const internals = this.internals;
    if (!internals) return;
    const disabled = this.disabled || this.#formDisabled;
    if (disabled) {
      internals.setFormValue(null);
      internals.setValidity({});
      return;
    }
    const value = this.#value;
    internals.setFormValue(value === '' ? null : value);
    if (this.required && value === '') {
      internals.setValidity({ valueMissing: true }, REQUIRED_MESSAGE, this.#select ?? undefined);
    } else {
      internals.setValidity({});
    }
  }

  /** Host `aria-label` / `aria-labelledby`, forwarded while no visible label exists. */
  #forwardedName(): string {
    const label = this.getAttribute('aria-label');
    const labelledby = this.getAttribute('aria-labelledby');
    return (
      (label ? ` aria-label="${escapeHtml(label)}"` : '') +
      (labelledby ? ` aria-labelledby="${escapeHtml(labelledby)}"` : '')
    );
  }

  /** Re-reads the light DOM: options may be added, removed or reconfigured. */
  #startObserving(): void {
    if (typeof MutationObserver === 'undefined') return;
    this.#observer ??= new MutationObserver(() => {
      this.#syncOptions();
    });
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['value', 'selected', 'disabled', 'label'],
    });
  }

  #onChange = (event: Event): void => {
    const select = this.#select;
    if (!select || event.target !== select) return;
    if (this.disabled || this.#formDisabled) return;
    this.#value = select.value;
    this.#valueSeeded = true;
    this.#syncForm();
    this.emit('an-select-change', { value: this.#value, originalEvent: event });
  };

  /**
   * The slot is recreated on every render, so this fires on connect too; the
   * signature check in `#syncOptions()` keeps it from re-entering.
   */
  #onSlotChange = (): void => {
    this.#syncOptions();
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

  get #select(): HTMLSelectElement | null {
    return this.shadowRoot?.querySelector('select') ?? null;
  }
}

export { SIZES };
