import { AnElement } from '../internal/base';
import { ISODate, compareISO, isValidISO } from '../internal/calendar';
import { formatDisplay } from './calendar-panel';
import { DateHost, DatePanelController, SHARED_DEFAULTS } from './date-base';
import dateStyles from './an-date.css?inline';
import panelStyles from './panel.css?inline';

/** Control sizes of `<an-date>`. */
export type AnDateSize = 'sm' | 'md' | 'lg';

/** Allowed `size` values; unknown attributes fall back to `md` through CSS. */
const SIZES: readonly AnDateSize[] = ['sm', 'md', 'lg'];

/** Shown to the owning form when `required` is set and nothing is selected. */
const REQUIRED_MESSAGE = '此字段为必填项。';

/** Payload of `an-date-change`. */
export interface AnDateChangeDetail {
  /** Selected day in `YYYY-MM-DD`, `''` when cleared. */
  value: ISODate;
  /** Event that caused the change (click, change, keydown or blur). */
  originalEvent: Event;
}

/**
 * `<an-date>` — a form-associated single-date picker.
 *
 * ```html
 * <an-date name="day" value="2026-11-19" min="2026-01-01" max="2026-12-31"></an-date>
 * ```
 *
 * The class extends `AnElement` directly (the build and CEM scanners derive the
 * tag name from that literal declaration); the shared calendar machinery lives
 * in `DatePanelController`, composed in the constructor.
 *
 * @attr value - Selected day in `YYYY-MM-DD`; seeds the property, never written back.
 * @attr min - Earliest selectable day in `YYYY-MM-DD`.
 * @attr max - Latest selectable day in `YYYY-MM-DD`.
 * @attr open - Controlled open state of the panel; reflect target of the `open` property.
 * @attr inline - Keeps the panel in flow and removes the trigger.
 * @attr disabled - Blocks every interaction and submission.
 * @attr readonly - Shows the value but forbids picking or typing.
 * @attr required - Reports `valueMissing` while no day is selected.
 * @attr placeholder - Placeholder of the text field.
 * @attr name - Field name submitted with the owning form.
 * @attr size - `sm` | `md` | `lg`.
 * @attr first-day - Weekday column 0: `0` = Sunday, `1` = Monday (default).
 * @attr format - Display pattern; `YYYY`, `MM`, `M`, `DD` and `D` are replaced.
 * @fires an-date-change - Fired when a day is picked, typed, cleared or reset; `detail: { value, originalEvent }`.
 * @fires an-date-open - Fired when the popover panel opens.
 * @fires an-date-close - Fired when the popover panel closes.
 * @slot label - Optional label rendered above the trigger.
 * @csspart base - Wrapper around the label, the trigger and the panel.
 * @csspart label - The visible label; hidden while the `label` slot is empty.
 * @csspart trigger - The clickable field that opens the panel.
 * @csspart input - The internal native `<input role="combobox">`.
 * @csspart panel - The calendar dialog.
 * @csspart header - Month bar holding the title and the two arrows.
 * @csspart title - The `YYYY年M月` title.
 * @csspart nav-prev - Previous-month button.
 * @csspart nav-next - Next-month button.
 * @csspart grid - The 6 x 7 `role="grid"` container.
 * @csspart weekday - One weekday column header.
 * @csspart day - One day button.
 * @csspart day-selected - Added to the selected day.
 * @csspart day-today - Added to today.
 * @csspart day-outside - Added to days of the neighbouring months.
 * @csspart footer - Bottom bar with the clear and today buttons.
 * @csspart clear - Clears the selection.
 * @csspart today - Selects today.
 * @cssprop --an-date-height - Trigger height; defaults to `--an-space-11`.
 * @cssprop --an-date-bg - Trigger background; defaults to `--an-color-bg-1`.
 * @cssprop --an-date-fg - Trigger text colour; defaults to `--an-color-fg-1`.
 * @cssprop --an-date-border-color - Trigger border; defaults to `--an-color-border-1`.
 * @cssprop --an-date-radius - Trigger radius; defaults to `--an-radius-md`.
 * @cssprop --an-date-font-size - Trigger font size; defaults to `--an-font-size-md`.
 * @cssprop --an-date-padding-x - Trigger horizontal padding; defaults to `--an-space-3`.
 * @cssprop --an-date-focus-ring - Focus ring colour; defaults to `--an-color-accent-9`.
 * @cssprop --an-date-muted-fg - Muted text (weekdays, outside days); defaults to `--an-color-gray-9`.
 * @cssprop --an-date-panel-bg - Panel background; defaults to `--an-color-bg-1`.
 * @cssprop --an-date-panel-fg - Panel text colour; defaults to `--an-color-fg-1`.
 * @cssprop --an-date-panel-border-color - Panel border; defaults to `--an-color-border-1`.
 * @cssprop --an-date-panel-radius - Panel radius; defaults to `--an-radius-lg`.
 * @cssprop --an-date-panel-shadow - Panel shadow.
 * @cssprop --an-date-day-size - Day button size; defaults to `2.25rem`.
 * @cssprop --an-date-day-hover-bg - Day hover background; defaults to `--an-color-gray-2`.
 * @cssprop --an-date-day-selected-bg - Selected day background; defaults to `--an-color-accent-9`.
 * @cssprop --an-date-day-selected-fg - Selected day text; defaults to `#ffffff`.
 * @cssprop --an-date-today-ring - Ring drawn around today; defaults to `--an-color-accent-9`.
 */
export class AnDate extends AnElement {
  static override styles: string = `${panelStyles}\n${dateStyles}`;

  static override formAssociated = true;

  static override defaults = {
    ...SHARED_DEFAULTS,
    format: 'YYYY-MM-DD',
    placeholder: '请选择日期',
    readonly: false,
  };

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'value', 'aria-label', 'aria-labelledby'];
  }

  /** Display pattern of the trigger text. */
  declare format: string;
  declare min: string;
  declare max: string;
  /** Controlled open state of the popover panel; reflects to the `open` attribute. */
  declare open: boolean;
  declare inline: boolean;
  declare disabled: boolean;
  declare required: boolean;
  declare placeholder: string;
  declare name: string;
  declare size: string;
  declare firstDay: number;

  /** Shows the value but forbids picking and typing. */
  declare readonly: boolean;

  #panel: DatePanelController;
  #formDisabled = false;
  #value: ISODate = '';
  #initialValue: ISODate = '';
  #initialCaptured = false;

  constructor() {
    super();
    this.#panel = new DatePanelController(this.#host());
    this.#panel.listen();
  }

  /** Selected day in `YYYY-MM-DD`; `''` when empty. */
  get value(): ISODate {
    return this.#value;
  }

  set value(next: ISODate) {
    this.#setValue(next);
  }

  /** Read-only alias of the controlled `open` state. */
  get isOpen(): boolean {
    return this.open;
  }

  /** Opens the panel; no-op when `inline`, `disabled` or `readonly`. */
  show(): void {
    if (this.inline || this.#blocked) return;
    this.open = true;
  }

  /** Closes the panel by clearing the controlled `open` state. */
  close(): void {
    this.open = false;
  }

  /** Flips the open state: `close()` while open, `show()` while closed. */
  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

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
      this.requestUpdate();
      return;
    }
    super.attributeChangedCallback(name, oldValue, value);
    this.#panel.attributeChanged(name, oldValue, value);
    if (name === 'readonly' && value !== null) this.#panel.blockedChanged();
  }

  override requestUpdate(): void {
    this.#panel.captureFocus();
    super.requestUpdate();
  }

  protected override render(): string {
    return (
      `<div class="base" part="base">` +
      this.#panel.renderLabel() +
      (this.inline ? '' : this.#panel.renderTrigger()) +
      this.#panel.renderPanel() +
      `</div>`
    );
  }

  protected override afterRender(): void {
    this.#syncForm();
    this.#panel.afterRender();
  }

  protected override onConnect(): void {
    this.#panel.connect();
    if (!this.#initialCaptured) {
      this.#initialCaptured = true;
      this.#initialValue = this.#value;
    }
    this.#syncForm();
  }

  protected override onDisconnect(): void {
    this.#panel.disconnect();
  }

  protected override onFormDisabled(disabled: boolean): void {
    this.#formDisabled = disabled;
    if (disabled) this.close();
    this.requestUpdate();
  }

  protected override onFormReset(): void {
    this.#value = this.#initialValue;
    this.close();
    this.requestUpdate();
  }

  /** Rows this element contributes to `FormData`; empty values submit nothing. */
  protected override formEntries(): Array<[string, string | File]> {
    if (this.name.length === 0 || this.#value === '') return [];
    return [[this.name, this.#value]];
  }

  get #blocked(): boolean {
    return this.disabled || this.readonly || this.#formDisabled;
  }

  #syncForm(): void {
    const internals = this.internals;
    if (internals === null) return;
    const value = this.#value;
    // A disabled control is left out of the form entry list entirely.
    if (this.name.length === 0 || value === '' || this.disabled || this.#formDisabled) {
      internals.setFormValue(null);
    } else {
      internals.setFormValue(value);
    }

    const missing =
      this.required && value === '' && !this.readonly && !this.disabled && !this.#formDisabled;
    if (missing) {
      internals.setValidity({ valueMissing: true }, REQUIRED_MESSAGE, this.#input() ?? undefined);
    } else {
      internals.setValidity({});
    }
  }

  #setValue(next: string): void {
    const value = isValidISO(next) ? next : '';
    if (value === this.#value) return;
    this.#value = value;
    this.requestUpdate();
  }

  #commitDay(iso: ISODate, originalEvent: Event): void {
    if (this.#blocked) return;
    this.#setValue(iso);
    this.emit<AnDateChangeDetail>('an-date-change', { value: this.#value, originalEvent });
    if (!this.inline) {
      this.close();
      this.#panel.focusTrigger();
    }
  }

  #clearSelection(originalEvent: Event): void {
    if (this.#value === '') return;
    this.#setValue('');
    this.emit<AnDateChangeDetail>('an-date-change', { value: '', originalEvent });
  }

  #commitInput(raw: string, originalEvent: Event): void {
    if (this.#blocked) return;
    const text = raw.trim();
    if (text === '') {
      this.#clearSelection(originalEvent);
      return;
    }
    if (!isValidISO(text) || this.#outsideRange(text)) {
      // Invalid or out of range: put the previous formatted value back.
      this.requestUpdate();
      return;
    }
    if (text !== this.#value) {
      this.#setValue(text);
      this.emit<AnDateChangeDetail>('an-date-change', { value: this.#value, originalEvent });
    }
    if (!this.inline && originalEvent.type === 'keydown') this.close();
  }

  #outsideRange(iso: ISODate): boolean {
    if (isValidISO(this.min) && compareISO(iso, this.min) < 0) return true;
    if (isValidISO(this.max) && compareISO(iso, this.max) > 0) return true;
    return false;
  }

  #input(): HTMLInputElement | null {
    return this.shadowRoot?.querySelector<HTMLInputElement>('input[data-focus="input"]') ?? null;
  }

  /** Adapter the shared controller talks to; keeps this class' API private. */
  #host(): DateHost {
    const element = this;
    return {
      element,
      get inline() {
        return element.inline;
      },
      get disabled() {
        return element.disabled;
      },
      get blocked() {
        return element.#blocked;
      },
      get formDisabled() {
        return element.#formDisabled;
      },
      get firstDay() {
        return element.firstDay;
      },
      get min() {
        return element.min;
      },
      get max() {
        return element.max;
      },
      get open() {
        return element.open;
      },
      get selectedDays() {
        return element.#value === '' ? [] : [element.#value];
      },
      get rangePreview() {
        return null;
      },
      get canClear() {
        return element.#value !== '' && !element.#blocked;
      },
      get displayText() {
        return element.#value === '' ? '' : formatDisplay(element.#value, element.format);
      },
      get placeholder() {
        return element.placeholder;
      },
      get inputReadonly() {
        return element.readonly;
      },
      get accessibleName() {
        return '日期';
      },
      get panelLabel() {
        return '选择日期';
      },
      get eventPrefix() {
        return 'an-date';
      },
      get emitPanelEvents() {
        return true;
      },
      show: () => this.show(),
      close: () => this.close(),
      setOpen: (next: boolean) => {
        this.open = next;
      },
      emitPanelEvent: (name: string) => {
        this.emit(name, {});
      },
      commitDay: (iso: ISODate, originalEvent: Event) => this.#commitDay(iso, originalEvent),
      clearSelection: (originalEvent: Event) => this.#clearSelection(originalEvent),
      commitInput: (raw: string, originalEvent: Event) => this.#commitInput(raw, originalEvent),
      onDayHover: () => {},
      requestUpdate: () => this.requestUpdate(),
    };
  }
}

export { SIZES };
