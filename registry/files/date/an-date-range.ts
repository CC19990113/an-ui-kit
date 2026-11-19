import { AnElement } from '../internal/base';
import { ISODate, compareISO, isValidISO } from '../internal/calendar';
import { PanelRange, escapeHtml, isBlockedDay } from './calendar-panel';
import { DateHost, DatePanelController, SHARED_DEFAULTS } from './date-base';
import rangeStyles from './an-date-range.css?inline';
import panelStyles from './panel.css?inline';

/** Payload of `an-date-range-change`. */
export interface AnDateRangeChangeDetail {
  /** Range start in `YYYY-MM-DD`, `''` when empty. */
  start: ISODate;
  /** Range end in `YYYY-MM-DD`, `''` when empty. */
  end: ISODate;
}

/** One shortcut offered by the `presets` property. */
export interface AnDateRangePreset {
  /** Button text; also the accessible name of the preset button. */
  label: string;
  /** Range start in `YYYY-MM-DD`. */
  start: ISODate;
  /** Range end in `YYYY-MM-DD`. */
  end: ISODate;
}

/** Shown to the owning form when `required` is set and the range is incomplete. */
const REQUIRED_MESSAGE = '此字段为必填项。';

/** Light-DOM attribute used to find the two hidden form fields again. */
const FIELD_ATTRIBUTE = 'data-an-date-range-field';

/**
 * Parses the `presets` attribute (JSON) or an assigned array.
 *
 * Returns `null` when the input cannot be understood at all — the caller then
 * keeps the previous presets instead of clearing them, so a malformed attribute
 * never throws and never drops the UI. Individual entries with a missing or
 * invalid `start` / `end` are dropped, and a reversed pair is sorted.
 */
function parsePresets(input: unknown): AnDateRangePreset[] | null {
  let source: unknown = input;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(source)) return null;
  const presets: AnDateRangePreset[] = [];
  for (const entry of source) {
    if (entry === null || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const start = typeof record.start === 'string' ? record.start : '';
    const end = typeof record.end === 'string' ? record.end : '';
    if (!isValidISO(start) || !isValidISO(end)) continue;
    const first = compareISO(start, end) <= 0 ? start : end;
    const last = compareISO(start, end) <= 0 ? end : start;
    const label = typeof record.label === 'string' ? record.label.trim() : '';
    presets.push({ label: label.length > 0 ? label : `${first} — ${last}`, start: first, end: last });
  }
  return presets;
}

/**
 * `<an-date-range>` — a form-associated date-range picker.
 *
 * Two clicks pick a range: the first sets the start, the second the end (the
 * pair is sorted, so an earlier second click becomes the new start). The first
 * click always starts a fresh range, even when one is already shown, so
 * dismissing the panel after that click leaves only the new start. While the
 * end is still missing, hovering a day paints the pending segment.
 *
 * ```html
 * <an-date-range name="from" end-name="to" start="2026-11-01" end="2026-11-19"></an-date-range>
 * ```
 *
 * The two submitted fields are backed by hidden inputs in the light DOM: the
 * platform's `ElementInternals.setFormValue()` carries one entry per element,
 * while a control that submits two named fields needs two entries. They are
 * disabled until both ends are known, so a half-picked range submits nothing.
 *
 * The class extends `AnElement` directly (the build and CEM scanners derive the
 * tag name from that literal declaration); the shared calendar machinery lives
 * in `DatePanelController`, composed in the constructor.
 *
 * @attr start - Range start in `YYYY-MM-DD`.
 * @attr end - Range end in `YYYY-MM-DD`.
 * @attr min - Earliest selectable day in `YYYY-MM-DD`.
 * @attr max - Latest selectable day in `YYYY-MM-DD`.
 * @attr open - Controlled open state of the panel; reflect target of the `open` property.
 * @attr inline - Keeps the panel in flow and removes the trigger.
 * @attr disabled - Blocks every interaction and submission.
 * @attr required - Reports `valueMissing` until both ends are set.
 * @attr placeholder - Placeholder of the text field; defaults to `开始日期 — 结束日期`.
 * @attr name - Field name submitted for the start day.
 * @attr end-name - Field name submitted for the end day.
 * @attr size - `sm` | `md` | `lg`.
 * @attr first-day - Weekday column 0: `0` = Sunday, `1` = Monday (default).
 * @attr presets - JSON array (`[{"label":"最近7天","start":"2026-11-01","end":"2026-11-07"}]`) rendered as shortcut buttons; invalid JSON is ignored.
 * @fires an-date-range-change - Fired when the range completes or clears; `detail: { start, end }`.
 * @fires an-date-range-open - Fired when the popover panel opens.
 * @fires an-date-range-close - Fired when the popover panel closes.
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
 * @csspart day-selected - Added to both range endpoints.
 * @csspart day-today - Added to today.
 * @csspart day-outside - Added to days of the neighbouring months.
 * @csspart footer - Bottom bar with the clear and today buttons.
 * @csspart clear - Clears the range.
 * @csspart today - Starts a range on today.
 * @csspart presets - Bottom bar holding the shortcut buttons.
 * @csspart preset - One shortcut button.
 * @cssprop --an-date-range-height - Trigger height; defaults to `--an-space-11`.
 * @cssprop --an-date-range-bg - Trigger background; defaults to `--an-color-bg-1`.
 * @cssprop --an-date-range-fg - Trigger text colour; defaults to `--an-color-fg-1`.
 * @cssprop --an-date-range-border-color - Trigger border; defaults to `--an-color-border-1`.
 * @cssprop --an-date-range-radius - Trigger radius; defaults to `--an-radius-md`.
 * @cssprop --an-date-range-font-size - Trigger font size; defaults to `--an-font-size-md`.
 * @cssprop --an-date-range-padding-x - Trigger padding; defaults to `--an-space-3`.
 * @cssprop --an-date-range-focus-ring - Focus ring colour; defaults to `--an-color-accent-9`.
 * @cssprop --an-date-range-muted-fg - Muted text; defaults to `--an-color-gray-9`.
 * @cssprop --an-date-range-panel-bg - Panel background; defaults to `--an-color-bg-1`.
 * @cssprop --an-date-range-panel-fg - Panel text colour; defaults to `--an-color-fg-1`.
 * @cssprop --an-date-range-panel-border-color - Panel border; defaults to `--an-color-border-1`.
 * @cssprop --an-date-range-panel-radius - Panel radius; defaults to `--an-radius-lg`.
 * @cssprop --an-date-range-panel-shadow - Panel shadow.
 * @cssprop --an-date-range-day-size - Day button size; defaults to `2.25rem`.
 * @cssprop --an-date-range-day-hover-bg - Day hover background; defaults to `--an-color-gray-2`.
 * @cssprop --an-date-range-day-selected-bg - Endpoint background; defaults to `--an-color-accent-9`.
 * @cssprop --an-date-range-day-selected-fg - Endpoint text; defaults to `#ffffff`.
 * @cssprop --an-date-range-in-range-bg - Background of days inside the range.
 * @cssprop --an-date-range-today-ring - Ring drawn around today; defaults to `--an-color-accent-9`.
 */
export class AnDateRange extends AnElement {
  static override styles: string = `${panelStyles}\n${rangeStyles}`;

  static override formAssociated = true;

  static override defaults = {
    ...SHARED_DEFAULTS,
    endName: '',
    placeholder: '开始日期 — 结束日期',
  };

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'start',
      'end',
      'aria-label',
      'aria-labelledby',
      'presets',
    ];
  }

  /** Field name submitted for the end day; `name` carries the start day. */
  declare endName: string;
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


  #panel: DatePanelController;
  #formDisabled = false;
  #start: ISODate = '';
  #end: ISODate = '';
  #initialStart: ISODate = '';
  #initialEnd: ISODate = '';
  #initialCaptured = false;
  /** `true` while the first endpoint is picked and the second is awaited. */
  #pending = false;
  /** Hovered day used for the pending-range preview. */
  #hover: ISODate = '';
  /** Shortcut ranges rendered at the bottom of the panel. */
  #presets: AnDateRangePreset[] = [];

  constructor() {
    super();
    this.#panel = new DatePanelController(this.#host());
    this.#panel.listen();
  }

  /** Range start in `YYYY-MM-DD`; `''` when empty. */
  get start(): ISODate {
    return this.#start;
  }

  set start(next: ISODate) {
    this.#setEndpoint('start', next);
  }

  /** Range end in `YYYY-MM-DD`; `''` when empty. */
  get end(): ISODate {
    return this.#end;
  }

  set end(next: ISODate) {
    this.#setEndpoint('end', next);
  }

  /** Read-only alias of the controlled `open` state. */
  get isOpen(): boolean {
    return this.open;
  }

  /**
   * Shortcut ranges rendered as buttons at the bottom of the panel.
   *
   * Assigning copies the list. The `presets` attribute holds the same data as
   * JSON. Entries with an unparsable `start` / `end` are dropped, and a
   * reversed pair is sorted. Presets outside `min` / `max` are disabled.
   * An empty list removes the preset bar entirely.
   */
  get presets(): AnDateRangePreset[] {
    return this.#presets.map((preset) => ({ ...preset }));
  }

  set presets(next: AnDateRangePreset[] | string) {
    this.#presets = parsePresets(next) ?? [];
    this.requestUpdate();
  }

  /** Opens the panel; no-op when `inline` or `disabled`. */
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
    if (name === 'start' || name === 'end') {
      if (oldValue === value) return;
      const iso = value !== null && isValidISO(value) ? value : '';
      if (name === 'start') this.#start = iso;
      else this.#end = iso;
      this.#pending = false;
      this.#hover = '';
      this.#order();
      this.requestUpdate();
      return;
    }
    if (name === 'aria-label' || name === 'aria-labelledby') {
      this.requestUpdate();
      return;
    }
    if (name === 'presets') {
      // A malformed attribute is ignored, so the previous list stays rendered.
      if (oldValue === value) return;
      const presets = parsePresets(value);
      if (presets === null) return;
      this.#presets = presets;
      this.requestUpdate();
      return;
    }
    super.attributeChangedCallback(name, oldValue, value);
    this.#panel.attributeChanged(name, oldValue, value);
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

  /**
   * Shortcut rail handed to the shared panel markup; empty when there is
   * nothing to offer, so no empty bar is ever rendered.
   */
  renderPresets(): string {
    const presets = this.#presets;
    if (presets.length === 0) return '';
    const buttons = presets
      .map(
        (preset, index) =>
          `<button class="preset" part="preset" type="button"` +
          ` data-preset-index="${index}"${this.#isPresetBlocked(preset) ? ' disabled' : ''}>` +
          `${escapeHtml(preset.label)}</button>`,
      )
      .join('');
    return `<div class="presets" part="presets" role="group" aria-label="快捷预设">${buttons}</div>`;
  }

  /**
   * Applies `presets[index]`: both endpoints are written in one step, the range
   * is announced with `an-date-range-change` and the panel closes unless the
   * element is `inline`. Returns the day the calendar should scroll to, or
   * `undefined` when the preset cannot be selected.
   */
  applyPreset(index: number): ISODate | undefined {
    const preset = this.#presets[index];
    if (preset === undefined || this.#isPresetBlocked(preset)) return undefined;
    this.#start = preset.start;
    this.#end = preset.end;
    this.#pending = false;
    this.#hover = '';
    this.requestUpdate();
    this.emit<AnDateRangeChangeDetail>('an-date-range-change', {
      start: preset.start,
      end: preset.end,
    });
    if (!this.inline) this.close();
    return preset.end;
  }

  protected override afterRender(): void {
    this.#syncForm();
    this.#panel.afterRender();
  }

  protected override onConnect(): void {
    this.#panel.connect();
    if (!this.#initialCaptured) {
      this.#initialCaptured = true;
      this.#initialStart = this.#start;
      this.#initialEnd = this.#end;
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
    this.#start = this.#initialStart;
    this.#end = this.#initialEnd;
    this.#pending = false;
    this.#hover = '';
    this.close();
    this.requestUpdate();
  }

  /** Rows this element contributes to `FormData`; incomplete ranges submit nothing. */
  protected override formEntries(): Array<[string, string | File]> {
    if (!this.#complete) return [];
    const entries: Array<[string, string | File]> = [];
    if (this.name.length > 0) entries.push([this.name, this.#start]);
    if (this.endName.length > 0) entries.push([this.endName, this.#end]);
    return entries;
  }

  get #blocked(): boolean {
    return this.disabled || this.#formDisabled;
  }

  #isPresetBlocked({ start, end }: AnDateRangePreset): boolean {
    const { min, max } = this;
    const minISO = isValidISO(min) ? min : undefined;
    const maxISO = isValidISO(max) ? max : undefined;
    return (
      isBlockedDay(start, minISO, maxISO, this.#blocked) ||
      isBlockedDay(end, minISO, maxISO, this.#blocked)
    );
  }

  get #complete(): boolean {
    return this.#start !== '' && this.#end !== '';
  }

  #syncForm(): void {
    this.#syncFields();
    const internals = this.internals;
    if (internals === null) return;
    // The two entries come from the hidden light-DOM fields below, not from
    // `setFormValue()`; this keeps a half-picked range out of the form.
    internals.setFormValue(null);

    const missing =
      this.required && !this.#complete && !this.disabled && !this.#formDisabled;
    if (missing) {
      internals.setValidity({ valueMissing: true }, REQUIRED_MESSAGE, this.#input() ?? undefined);
    } else {
      internals.setValidity({});
    }
  }

  #setEndpoint(kind: 'start' | 'end', next: string): void {
    const iso = isValidISO(next) ? next : '';
    if (kind === 'start') {
      if (this.#start === iso) return;
      this.#start = iso;
    } else {
      if (this.#end === iso) return;
      this.#end = iso;
    }
    this.#pending = false;
    this.#hover = '';
    this.#order();
    this.requestUpdate();
  }

  /** Keeps the pair ordered so `start <= end` always holds. */
  #order(): void {
    if (this.#start === '' || this.#end === '') return;
    if (compareISO(this.#start, this.#end) <= 0) return;
    const swap = this.#start;
    this.#start = this.#end;
    this.#end = swap;
  }

  #commitDay(iso: ISODate, originalEvent: Event): void {
    if (this.#blocked) return;
    if (!this.#pending) {
      this.#start = iso;
      this.#end = '';
      this.#pending = true;
      this.#hover = iso;
      this.requestUpdate();
      return;
    }

    let start = this.#start;
    let end = iso;
    if (compareISO(end, start) < 0) {
      const swap = start;
      start = end;
      end = swap;
    }
    this.#start = start;
    this.#end = end;
    this.#pending = false;
    this.#hover = '';
    this.requestUpdate();
    this.emit<AnDateRangeChangeDetail>('an-date-range-change', { start, end });
    if (!this.inline) {
      this.close();
      this.#panel.focusTrigger();
    }
    void originalEvent;
  }

  #clearSelection(originalEvent: Event): void {
    if (this.#start === '' && this.#end === '') return;
    this.#start = '';
    this.#end = '';
    this.#pending = false;
    this.#hover = '';
    this.requestUpdate();
    this.emit<AnDateRangeChangeDetail>('an-date-range-change', { start: '', end: '' });
    void originalEvent;
  }

  #onDayHover(iso: ISODate): void {
    if (!this.#pending) return;
    const next = isValidISO(iso) ? iso : '';
    if (next === this.#hover) return;
    this.#hover = next;
    this.requestUpdate();
  }

  /** Mirrors `start`/`end` into the two hidden fields the form serializes. */
  #syncFields(): void {
    this.#syncField('start', this.name, this.#start);
    this.#syncField('end', this.endName, this.#end);
  }

  #syncField(kind: 'start' | 'end', name: string, value: string): void {
    if (typeof document === 'undefined') return;
    const selector = `input[${FIELD_ATTRIBUTE}="${kind}"]`;
    const existing = this.querySelector<HTMLInputElement>(selector);
    if (name.length === 0) {
      existing?.remove();
      return;
    }
    const field = existing ?? this.#createField(kind);
    field.name = name;
    field.value = value;
    field.disabled = this.disabled || this.#formDisabled || !this.#complete;
  }

  #createField(kind: 'start' | 'end'): HTMLInputElement {
    const field = document.createElement('input');
    field.type = 'hidden';
    field.setAttribute(FIELD_ATTRIBUTE, kind);
    this.append(field);
    return field;
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
        const days: ISODate[] = [];
        if (element.#start !== '') days.push(element.#start);
        if (element.#end !== '') days.push(element.#end);
        return days;
      },
      get rangePreview(): PanelRange | null {
        if (element.#pending) {
          return {
            start: element.#start,
            end: element.#hover === '' ? element.#start : element.#hover,
          };
        }
        if (element.#start === '' && element.#end === '') return null;
        return {
          start: element.#start,
          end: element.#end === '' ? element.#start : element.#end,
        };
      },
      get canClear() {
        return (element.#start !== '' || element.#end !== '') && !element.#blocked;
      },
      get displayText() {
        if (element.#start === '' && element.#end === '') return '';
        if (element.#start !== '' && element.#end !== '') {
          return `${element.#start} — ${element.#end}`;
        }
        return element.#start !== '' ? element.#start : element.#end;
      },
      get placeholder() {
        return element.placeholder;
      },
      get inputReadonly() {
        return true;
      },
      get accessibleName() {
        return '日期范围';
      },
      get panelLabel() {
        return '选择日期范围';
      },
      get eventPrefix() {
        return 'an-date-range';
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
      renderPresets: () => this.renderPresets(),
      applyPreset: (index: number) => this.applyPreset(index),
      commitInput: () => {},
      onDayHover: (iso: ISODate) => this.#onDayHover(iso),
      requestUpdate: () => this.requestUpdate(),
    };
  }
}
