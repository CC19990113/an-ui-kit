import radioStyles from './an-radio.css?inline';
import { AnElement } from '../internal/base';

/** Payload of `an-radio-select`, dispatched when the control becomes checked. */
export interface AnRadioEventDetail {
  /** The `value` of the radio that got selected. */
  value: string;
  /** The click / change event that triggered the selection. */
  originalEvent: Event;
}

/** `&` -> `&amp;`, so attribute text can never break out of the markup. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * `<an-radio>` — one option of a radio group.
 *
 * The element itself is **not** form associated: a standalone radio has no
 * meaningful submitted value, so `<an-radio-group>` owns the form entry. The
 * host only renders a real `<input type="radio">` (focus, keyboard activation
 * and the accessible role come from the platform) and reports a selection with
 * `an-radio-select`, which the group listens to.
 *
 * The native inputs live in separate shadow roots, one per `<an-radio>`, so the
 * browser does not group them even when their `name` matches. Arrow-key
 * navigation is therefore implemented by the group; see `an-radio-group.ts`.
 *
 * @attr {string} value - Submitted value of the option.
 * @attr {boolean} checked - Checked state, driven by the owning `<an-radio-group>`.
 * @attr {boolean} disabled - Disables the option and blocks selection.
 * @slot - Label text of the option.
 * @fires an-radio-connect - Fired when the option connects, so a group can re-sync after a late upgrade.
 * @fires an-radio-select - Fired when this option becomes checked; `detail = { value, originalEvent }`.
 * @cssprop --an-radio-size - Edge length of the painted control; defaults to `--an-space-4` (1rem).
 * @cssprop --an-radio-accent - Checked fill and border colour; defaults to `--an-color-accent-9`.
 * @cssprop --an-radio-border-color - Unchecked border colour; defaults to `--an-color-border-1`.
 * @csspart base - The `<label>` wrapper around the control and the label text.
 * @csspart control - The painted radio control (a decorative sibling of the native input).
 * @csspart label - The slot wrapper for the visible label text.
 */
export class AnRadio extends AnElement {
  static override styles = radioStyles;

  static override defaults = {
    value: '',
    checked: false,
    disabled: false,
  };

  /** Submitted value of the option. */
  declare value: string;
  /** Checked state, driven by the owning `<an-radio-group>`. */
  declare checked: boolean;
  /** Disabled state, either its own or pushed down by the group. */
  declare disabled: boolean;

  /**
   * Roving tab stop inside a radio group. `<an-radio-group>` keeps exactly one
   * enabled radio `tabbable`, so Tab enters the group once and the arrows move
   * inside it. A standalone radio stays tabbable.
   */
  #tabbable = true;

  /** Whether focus currently sits on the inner input. */
  #focusWithin = false;

  constructor() {
    super();
    // Delegation: clicks on the control, on the label text *and* on slotted
    // content all bubble to the host.
    this.addEventListener('click', this.#onClick);
    const root = this.shadowRoot!;
    root.addEventListener('change', this.#onChange);
    root.addEventListener('focusin', this.#onFocusIn);
    root.addEventListener('focusout', this.#onFocusOut);
  }

  get tabbable(): boolean {
    return this.#tabbable;
  }

  set tabbable(next: boolean) {
    const tabbable = Boolean(next);
    if (tabbable === this.#tabbable) return;
    this.#tabbable = tabbable;
    this.requestUpdate();
  }

  /**
   * Re-rendering replaces the inner `<input>`; without this the platform would
   * drop focus to `<body>` every time the checked state changes.
   */
  override requestUpdate(): void {
    const focused = this.#focusWithin;
    super.requestUpdate();
    if (focused && this.isConnected) this.#input?.focus();
  }

  /** Focus lands on the native radio, not on the (unfocusable) host. */
  override focus(options?: FocusOptions): void {
    this.#input?.focus(options);
  }

  protected render(): string {
    const attrs =
      ` class="input" type="radio"` +
      ` value="${escapeHtml(this.value)}"` +
      (this.checked ? ' checked aria-checked="true"' : ' aria-checked="false"') +
      (this.disabled ? ' disabled aria-disabled="true"' : '') +
      ` tabindex="${this.#tabbable ? 0 : -1}"`;
    return (
      `<label class="base" part="base">` +
      `<input${attrs} />` +
      `<span class="control" part="control" aria-hidden="true"></span>` +
      `<span class="label" part="label"><slot></slot></span>` +
      `</label>`
    );
  }

  protected override onConnect(): void {
    // Lets an owning group finish its registration sync even when the option is
    // upgraded after the group (the group may not see a `slotchange` for it).
    this.emit('an-radio-connect', { value: this.value });
  }

  /** Becomes checked and tells the group; already-checked radios stay silent. */
  #select(originalEvent: Event): void {
    if (this.disabled || this.checked) return;
    this.checked = true;
    this.emit<AnRadioEventDetail>('an-radio-select', {
      value: this.value,
      originalEvent,
    });
  }

  #onClick = (event: MouseEvent): void => {
    this.#select(event);
  };

  /**
   * Keyboard activation (Space) through the native input. Mouse clicks are
   * handled by `#onClick`; the subsequent `change` then finds the radio already
   * checked and stays silent.
   */
  #onChange = (event: Event): void => {
    if (event.target !== this.#input) return;
    this.#select(event);
  };

  #onFocusIn = (): void => {
    this.#focusWithin = true;
  };

  #onFocusOut = (): void => {
    this.#focusWithin = false;
  };

  get #input(): HTMLInputElement | null {
    return this.shadowRoot?.querySelector('input') ?? null;
  }
}
