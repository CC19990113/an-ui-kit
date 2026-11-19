/**
 * Composition helper shared by `<an-date>` and `<an-date-range>`.
 *
 * The two elements must each literally `extends AnElement` (the build and the
 * CEM scanner derive the tag name from that declaration), so the shared
 * calendar machinery lives in this plain controller class instead of a common
 * base element. Each component creates one controller in its constructor and
 * forwards the lifecycle hooks, attributes and render slots to it:
 *
 * ```ts
 * this.#panel = new DatePanelController(this.#host());
 * ```
 *
 * The controller owns the month view, the popover (`AnPopover`), the
 * roving-focus keyboard model, the controlled `open` state and the focus/scroll
 * restoration that the `innerHTML` re-render would otherwise destroy. It never
 * extends `AnElement` and never registers a custom element.
 */

import { AnPopover } from '../internal/popover';
import {
  ISODate,
  addMonths,
  compareISO,
  isValidISO,
  monthMatrix,
  parseISO,
  todayISO,
} from '../internal/calendar';
import {
  CalendarMatrix,
  PanelRange,
  escapeHtml,
  gridBounds,
  isBlockedDay,
  nearestEnabled,
  renderCalendarPanel,
  stepFocus,
  weekEnd,
  weekStart,
} from './calendar-panel';

/** Attributes every date control declares; a component spreads this into `defaults`. */
export const SHARED_DEFAULTS = {
  disabled: false,
  firstDay: 1,
  inline: false,
  max: '',
  min: '',
  name: '',
  open: false,
  placeholder: '',
  required: false,
  size: 'md',
} as const;

/** Everything `DatePanelController` needs from the element that owns it. */
export interface DateHost {
  /** The component instance; the controller reads attributes and the shadow root. */
  readonly element: HTMLElement;
  readonly inline: boolean;
  readonly disabled: boolean;
  /** `true` when no day may be picked (disabled, form-disabled or readonly). */
  readonly blocked: boolean;
  readonly formDisabled: boolean;
  readonly firstDay: number;
  readonly min: string;
  readonly max: string;
  /** Controlled open state; the controller forces it back to `false` when unusable. */
  readonly open: boolean;
  /** Endpoints painted as selected. */
  readonly selectedDays: readonly ISODate[];
  /** Range painted behind the days; `null` in `<an-date>`. */
  readonly rangePreview: PanelRange | null;
  readonly canClear: boolean;
  /** Text shown inside the trigger input. */
  readonly displayText: string;
  readonly placeholder: string;
  readonly inputReadonly: boolean;
  /** Fallback accessible name of the trigger. */
  readonly accessibleName: string;
  /** Accessible name of the dialog. */
  readonly panelLabel: string;
  /** Prefix of the emitted events (`an-date`, `an-date-range`). */
  readonly eventPrefix: string;
  /** Whether opening/closing the panel emits its own events. */
  readonly emitPanelEvents: boolean;
  /** Opens the panel through the component so its guard keeps working. */
  show(): void;
  /** Closes the panel by clearing the controlled state. */
  close(): void;
  /** Writes the controlled state straight from the controller. */
  setOpen(next: boolean): void;
  /** Emits `<eventPrefix>-open` / `-close` with the component's `emit`. */
  emitPanelEvent(name: string): void;
  /** Handles a day picked by click, Enter or the footer "今天" button. */
  commitDay(iso: ISODate, originalEvent: Event): void;
  /** Handles the footer "清除" button. */
  clearSelection(originalEvent: Event): void;
  /** Commits the text typed into the trigger (blur / Enter). */
  commitInput(raw: string, originalEvent: Event): void;
  /** A day cell was hovered; `''` means the pointer left the grid. */
  onDayHover(iso: ISODate): void;
  /** Re-renders the owning element. */
  requestUpdate(): void;
}

/** Day-cell key used by the focus-restore map: `iso:2026-11-19`. */
const ISO_PREFIX = 'iso:';

/**
 * `ShadowRoot#activeElement` walks the host chain and can throw while the tree
 * is detached (e.g. after the element was removed mid-interaction); treat that
 * as "no focus inside the control".
 */
function shadowActiveElement(root: ShadowRoot | null | undefined): HTMLElement | null {
  if (root === null || root === undefined) return null;
  try {
    return (root.activeElement as HTMLElement | null) ?? null;
  } catch {
    return null;
  }
}

/** Inline calendar icon; decorative, the input carries the accessible name. */
const CALENDAR_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<rect x="3" y="5" width="18" height="16" rx="2"></rect>' +
  '<path d="M8 3v4M16 3v4M3 10h18"></path>' +
  '</svg>';

/**
 * Calendar state and behaviour shared by the two date controls.
 *
 * Composition, not inheritance: the controller is a plain class, so the
 * components keep the literal `export class AnDate extends AnElement` shape the
 * build and CEM scanners require.
 */
export class DatePanelController {
  #host: DateHost;
  #viewYear = 1970;
  #viewMonth = 1;
  /** Roving-focus day; always a valid `YYYY-MM-DD` once `connect()` ran. */
  #focusedISO = '';
  #panelOpen = false;
  #popover: AnPopover | null = null;
  #savedFocus: string | null = null;
  #pendingFocus: string | null = null;
  #savedScrollTop = 0;
  #hasLabel = false;
  #syncingOpen = false;
  /** `open` resolved to `true` after the last sync, so the view resets only once. */
  #wasOpen = false;

  constructor(host: DateHost) {
    this.#host = host;
  }

  /** Installs the delegated listeners on the shadow root; call after `super()`. */
  listen(): void {
    const root = this.#shadow();
    if (root === null) return;
    root.addEventListener('click', this.#onClick);
    root.addEventListener('keydown', this.#onKeyDown);
    root.addEventListener('focusout', this.#onFocusOut);
    root.addEventListener('pointerover', this.#onPointerOver);
    root.addEventListener('pointerout', this.#onPointerOut);
    root.addEventListener('slotchange', this.#onSlotChange);
  }

  /** Hooks the controller into the element lifecycle (`onConnect`). */
  connect(): void {
    this.#wasOpen = false;
    this.#focusedISO = this.#focusAnchor();
    this.#syncView(this.#focusedISO);
    // `connectedCallback()` renders before this hook runs, so the first paint
    // would show the initial 1970 view; sync it with the real month.
    this.#syncOpenState();
  }

  /** Releases the popover listeners while the element is out of the document. */
  disconnect(): void {
    this.#popover?.destroy();
    this.#popover = null;
    this.#panelOpen = false;
  }

  /** Popover lifecycle and focus restoration; call from `afterRender()`. */
  afterRender(): void {
    this.#syncPopover();
    this.#restoreFocus();
  }

  /** Remembers focus and scroll before `AnElement` replaces the shadow DOM. */
  captureFocus(): void {
    const active = shadowActiveElement(this.#shadow());
    this.#savedFocus =
      active === null
        ? null
        : active.dataset.iso !== undefined
          ? `${ISO_PREFIX}${active.dataset.iso}`
          : active.dataset.focus ?? null;
    this.#savedScrollTop = this.#panel()?.scrollTop ?? 0;
  }

  /** Reacts to reflected attributes the controller owns. */
  attributeChanged(name: string, oldValue: string | null, value: string | null): void {
    if (name === 'open') {
      if (this.#syncingOpen || oldValue === value) return;
      this.#syncOpenState();
      return;
    }
    if (name === 'disabled' || name === 'inline') this.#syncBlockedState();
  }

  /** Closes an open panel after `blocked` changed through a component-owned attribute. */
  blockedChanged(): void {
    this.#syncBlockedState();
  }

  /** Focuses the trigger text field after a close. */
  focusTrigger(): void {
    const input = this.#input();
    if (input !== null) input.focus();
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  /** Label slot wrapper; hidden until the light DOM fills it. */
  renderLabel(): string {
    return (
      `<span class="label" part="label"${this.#hasLabel ? '' : ' hidden'}>` +
      `<slot name="label"></slot></span>`
    );
  }

  /** Trigger markup; the component omits it in `inline` mode. */
  renderTrigger(): string {
    const host = this.#host;
    const display = host.displayText;
    const nameAttribute = this.#accessibleNameAttribute();
    const inactive = host.disabled || host.formDisabled;
    return (
      `<div class="trigger" part="trigger" data-trigger=""` +
      `${inactive ? ' data-disabled=""' : ''}>` +
      `<input class="input" part="input" data-focus="input" type="text" role="combobox"` +
      ` autocomplete="off" spellcheck="false" aria-haspopup="dialog"` +
      ` aria-expanded="${host.open ? 'true' : 'false'}"` +
      `${nameAttribute}` +
      ` placeholder="${escapeHtml(host.placeholder)}"` +
      (display.length > 0 ? ` value="${escapeHtml(display)}"` : '') +
      (inactive ? ' disabled' : '') +
      (host.inputReadonly ? ' readonly' : '') +
      `>` +
      `<span class="icon">${CALENDAR_ICON}</span>` +
      `</div>`
    );
  }

  /** Panel wrapper plus the month grid. */
  renderPanel(): string {
    const host = this.#host;
    const hidden = !host.inline && !host.open;
    const body = renderCalendarPanel({
      year: this.#viewYear,
      month: this.#viewMonth,
      firstDay: host.firstDay === 0 ? 0 : 1,
      selected: host.selectedDays,
      range: host.rangePreview,
      focused: this.#focusedISO === '' ? null : this.#focusedISO,
      min: this.#minISO,
      max: this.#maxISO,
      today: todayISO(),
      blocked: host.blocked,
      clear: host.canClear,
    });
    return (
      `<div class="panel" part="panel" role="dialog" aria-modal="false"` +
      ` aria-label="${escapeHtml(host.panelLabel)}"${hidden ? ' hidden' : ''}>` +
      body +
      `</div>`
    );
  }

  #accessibleNameAttribute(): string {
    const element = this.#host.element;
    const label = element.getAttribute('aria-label');
    if (label !== null && label.length > 0) return ` aria-label="${escapeHtml(label)}"`;
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy !== null && labelledBy.length > 0) {
      return ` aria-labelledby="${escapeHtml(labelledBy)}"`;
    }
    return ` aria-label="${escapeHtml(this.#host.accessibleName)}"`;
  }

  // -------------------------------------------------------------------------
  // Open / close
  // -------------------------------------------------------------------------

  /** Writes the controlled state without re-entering the attribute handler. */
  #writeOpen(next: boolean): void {
    if (this.#host.open === next) return;
    this.#syncingOpen = true;
    try {
      this.#host.setOpen(next);
    } finally {
      this.#syncingOpen = false;
    }
  }

  /**
   * Resolves the controlled `open` state: forces it off where the panel cannot
   * exist (`inline`, `disabled`, `readonly`), starts the view on the selection
   * the first time it opens and re-renders so `afterRender()` can recreate the
   * popover.
   */
  #syncOpenState(): void {
    const host = this.#host;
    const wanted = host.open && !host.inline && !host.blocked;
    if (wanted !== host.open) {
      this.#writeOpen(wanted);
      this.#wasOpen = false;
      this.#pendingFocus = null;
      return;
    }
    if (wanted && !this.#wasOpen) {
      this.#focusedISO = this.#focusAnchor();
      this.#syncView(this.#focusedISO);
    }
    if (!wanted) this.#pendingFocus = null;
    this.#wasOpen = wanted;
    host.requestUpdate();
  }

  #syncBlockedState(): void {
    if (this.#host.blocked || this.#host.inline) this.#writeOpen(false);
  }

  #onPopoverClose = (): void => {
    if (!this.#host.open) return;
    // A keyboard dismissal leaves focus on a day button that is about to be
    // re-rendered away; an outside click already moved focus by itself.
    const focusWasInside = shadowActiveElement(this.#shadow()) !== null;
    this.#host.close();
    if (focusWasInside) this.focusTrigger();
  };

  #syncPopover(): void {
    const host = this.#host;
    const panel = this.#panel();
    if (host.inline || !host.open) {
      this.#popover?.destroy();
      this.#popover = null;
      if (this.#panelOpen) {
        this.#panelOpen = false;
        if (host.emitPanelEvents) host.emitPanelEvent(`${host.eventPrefix}-close`);
      }
      return;
    }
    const anchor = this.#shadow()?.querySelector<HTMLElement>('[part~="trigger"]') ?? null;
    if (panel === null || anchor === null) return;
    this.#popover?.destroy();
    this.#popover = new AnPopover({
      anchor,
      floating: panel,
      offset: 4,
      matchWidth: true,
      onClose: this.#onPopoverClose,
    });
    this.#popover.open();
    if (!this.#panelOpen) {
      this.#panelOpen = true;
      if (host.emitPanelEvents) host.emitPanelEvent(`${host.eventPrefix}-open`);
    }
  }

  #syncView(iso: ISODate): void {
    const parts = parseISO(iso);
    if (parts === null) return;
    this.#viewYear = parts.year;
    this.#viewMonth = parts.month;
  }

  // -------------------------------------------------------------------------
  // Focus restore
  // -------------------------------------------------------------------------

  #restoreFocus(): void {
    const panel = this.#panel();
    if (panel !== null) panel.scrollTop = this.#savedScrollTop;
    const pending = this.#pendingFocus;
    const saved = this.#savedFocus;
    this.#pendingFocus = null;
    this.#savedFocus = null;
    if (!this.#host.open && !this.#host.inline) return;
    if (pending !== null && this.#focusByKey(pending)) return;
    if (saved !== null) this.#focusByKey(saved);
  }

  #focusByKey(key: string): boolean {
    if (key.startsWith(ISO_PREFIX)) return this.#focusDayButton(key.slice(ISO_PREFIX.length));
    if (!/^[a-z]+$/.test(key)) return false;
    const target = this.#shadow()?.querySelector<HTMLElement>(`[data-focus="${key}"]`) ?? null;
    if (target === null || target.hasAttribute('disabled') || target.closest('[hidden]') !== null) {
      return false;
    }
    target.focus();
    return true;
  }

  #focusDayButton(iso: string): boolean {
    const button = this.#dayButton(iso);
    if (button === null || button.disabled) return false;
    button.focus();
    return true;
  }

  // -------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------

  #onClick = (event: Event): void => {
    const target = event.target as Element | null;
    if (target === null) return;

    const day = target.closest('[data-iso]');
    if (day !== null) {
      this.#clickDay(day as HTMLElement, event);
      return;
    }

    const trigger = target.closest('[data-trigger]');
    if (trigger !== null) {
      this.focusTrigger();
      this.#host.show();
      return;
    }

    const action = target.closest('[data-focus]') as HTMLElement | null;
    if (action === null) return;
    switch (action.dataset.focus) {
      case 'prev':
        this.#stepMonth(-1, false);
        break;
      case 'next':
        this.#stepMonth(1, false);
        break;
      case 'clear':
        if (!this.#host.blocked) this.#host.clearSelection(event);
        break;
      case 'today':
        this.#pickToday(event);
        break;
      default:
        break;
    }
  };

  #clickDay(day: HTMLElement, event: Event): void {
    if (this.#host.blocked) return;
    const iso = day.dataset.iso ?? '';
    if (!isValidISO(iso) || this.#isBlocked(iso)) return;
    this.#focusedISO = iso;
    this.#host.commitDay(iso, event);
  }

  #pickToday(event: Event): void {
    const today = todayISO();
    if (this.#host.blocked || this.#isBlocked(today)) return;
    this.#focusedISO = today;
    this.#syncView(today);
    this.#host.commitDay(today, event);
  }

  #onKeyDown = (event: Event): void => {
    const keyboard = event as KeyboardEvent;
    const host = this.#host;
    const target = event.target as HTMLElement | null;
    const iso = target?.dataset.iso ?? '';
    const onInput = target?.dataset.focus === 'input';

    if (keyboard.key === 'Escape') {
      if (host.inline) return;
      if (host.open) {
        event.preventDefault();
        host.close();
        this.focusTrigger();
      }
      return;
    }

    if (onInput) {
      if (host.blocked) return;
      if (keyboard.key === 'ArrowDown' || keyboard.key === 'ArrowUp') {
        event.preventDefault();
        if (!host.open) host.show();
        this.#focusIntoGrid();
        return;
      }
      if (keyboard.key === 'Enter') {
        host.commitInput((target as HTMLInputElement).value, event);
      }
      return;
    }

    if (iso.length === 0 || host.blocked) return;

    switch (keyboard.key) {
      case 'ArrowLeft':
        this.#moveFocus(-1);
        break;
      case 'ArrowRight':
        this.#moveFocus(1);
        break;
      case 'ArrowUp':
        this.#moveFocus(-7);
        break;
      case 'ArrowDown':
        this.#moveFocus(7);
        break;
      case 'PageUp':
        this.#stepMonth(-1, true);
        break;
      case 'PageDown':
        this.#stepMonth(1, true);
        break;
      case 'Home':
        this.#focusWeekEdge(false);
        break;
      case 'End':
        this.#focusWeekEdge(true);
        break;
      case 'Enter':
      case ' ':
        host.commitDay(iso, event);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /** Moves real focus into the grid, e.g. from ArrowDown on the trigger. */
  #focusIntoGrid(): void {
    const matrix = this.#matrix();
    const bounds = gridBounds(matrix);
    let target = this.#focusedISO === '' ? this.#focusAnchor() : this.#focusedISO;
    if (compareISO(target, bounds.first) < 0) target = bounds.first;
    if (compareISO(target, bounds.last) > 0) target = bounds.last;
    const next = nearestEnabled(target, bounds, (iso: ISODate): boolean => this.#isBlocked(iso));
    this.#focusedISO = next;
    this.#syncView(next);
    this.#pendingFocus = `${ISO_PREFIX}${next}`;
    this.#host.requestUpdate();
  }

  #moveFocus(delta: number): void {
    const matrix = this.#matrix();
    const bounds = gridBounds(matrix);
    const current = this.#focusedISO === '' ? bounds.first : this.#focusedISO;
    const next = stepFocus(current, delta, bounds, (iso: ISODate): boolean => this.#isBlocked(iso));
    this.#focusedISO = next;
    this.#pendingFocus = `${ISO_PREFIX}${next}`;
    this.#host.requestUpdate();
  }

  #focusWeekEdge(end: boolean): void {
    const matrix = this.#matrix();
    const bounds = gridBounds(matrix);
    const firstDay = this.#host.firstDay === 0 ? 0 : 1;
    const current = this.#focusedISO === '' ? bounds.first : this.#focusedISO;
    let target = end ? weekEnd(current, firstDay) : weekStart(current, firstDay);
    if (compareISO(target, bounds.first) < 0) target = bounds.first;
    if (compareISO(target, bounds.last) > 0) target = bounds.last;
    const next = nearestEnabled(target, bounds, (iso: ISODate): boolean => this.#isBlocked(iso));
    this.#focusedISO = next;
    this.#pendingFocus = `${ISO_PREFIX}${next}`;
    this.#host.requestUpdate();
  }

  #stepMonth(delta: number, focusDayButton: boolean): void {
    const view = addMonths({ year: this.#viewYear, month: this.#viewMonth }, delta);
    const matrix = monthMatrix(view.year, view.month, this.#host.firstDay === 0 ? 0 : 1);
    const bounds = gridBounds(matrix);
    const focused = parseISO(this.#focusedISO === '' ? this.#viewMonthISO() : this.#focusedISO);
    const day = focused === null ? 1 : focused.day;
    const inMonth = matrix.flat().filter((cell) => cell.inMonth);
    const index = Math.min(day, inMonth.length) - 1;
    const wanted = inMonth[index < 0 ? 0 : index].iso;
    const next = nearestEnabled(wanted, bounds, (iso: ISODate): boolean => this.#isBlocked(iso));
    this.#viewYear = view.year;
    this.#viewMonth = view.month;
    this.#focusedISO = next;
    if (focusDayButton) this.#pendingFocus = `${ISO_PREFIX}${next}`;
    this.#host.requestUpdate();
  }

  #onFocusOut = (event: Event): void => {
    const focusEvent = event as FocusEvent;
    const target = event.target as HTMLElement | null;
    if (target?.dataset.focus !== 'input') return;
    const related = focusEvent.relatedTarget as Node | null;
    if (related !== null && this.#shadow()?.contains(related) === true) return;
    const input = this.#input();
    if (input === null) return;
    this.#host.commitInput(input.value, event);
  };

  #onPointerOver = (event: Event): void => {
    const target = (event.target as Element | null)?.closest('[data-iso]') as HTMLElement | null;
    if (target === null) return;
    this.#host.onDayHover(target.dataset.iso ?? '');
  };

  #onPointerOut = (event: Event): void => {
    const related = (event as PointerEvent).relatedTarget as Element | null;
    if (related !== null) {
      const grid = this.#shadow()?.querySelector('[part~="grid"]') ?? null;
      if (grid !== null && grid.contains(related)) return;
    }
    this.#host.onDayHover('');
  };

  #onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    const has = slot
      .assignedNodes({ flatten: true })
      .some((node) => (node.textContent ?? '').trim().length > 0);
    if (has === this.#hasLabel) return;
    this.#hasLabel = has;
    this.#host.requestUpdate();
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  #shadow(): ShadowRoot | null {
    return this.#host.element.shadowRoot;
  }

  #focusAnchor(): ISODate {
    const [first] = this.#host.selectedDays;
    return first !== undefined && isValidISO(first) ? first : todayISO();
  }

  #viewMonthISO(): ISODate {
    const month = String(this.#viewMonth).padStart(2, '0');
    return `${this.#viewYear}-${month}-01`;
  }

  #matrix(): CalendarMatrix {
    return monthMatrix(this.#viewYear, this.#viewMonth, this.#host.firstDay === 0 ? 0 : 1);
  }

  #isBlocked(iso: ISODate): boolean {
    return isBlockedDay(iso, this.#minISO, this.#maxISO, this.#host.blocked);
  }

  get #minISO(): ISODate | undefined {
    const { min } = this.#host;
    return isValidISO(min) ? min : undefined;
  }

  get #maxISO(): ISODate | undefined {
    const { max } = this.#host;
    return isValidISO(max) ? max : undefined;
  }

  #panel(): HTMLElement | null {
    return this.#shadow()?.querySelector<HTMLElement>('[part~="panel"]') ?? null;
  }

  #input(): HTMLInputElement | null {
    return (
      this.#shadow()?.querySelector<HTMLInputElement>('input[data-focus="input"]') ?? null
    );
  }

  #dayButton(iso: ISODate): HTMLButtonElement | null {
    return (
      this.#shadow()?.querySelector<HTMLButtonElement>(`button[data-iso="${iso}"]`) ?? null
    );
  }
}
