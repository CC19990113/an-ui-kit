/**
 * Markup builders shared by `<an-date>` and `<an-date-range>`.
 *
 * Pure string functions only: the calendar arithmetic comes from
 * `internal/calendar.ts`, so no component here depends on the DOM and the same
 * grid renders identically in both controls. Every day stays a local calendar
 * field — no `toISOString()` / UTC conversion.
 */

import {
  ISODate,
  addDays,
  compareISO,
  isValidISO,
  monthMatrix,
  parseISO,
  weekdayLabels,
} from '../internal/calendar';

/** One cell of the rendered month grid. */
interface MatrixCell {
  iso: ISODate;
  inMonth: boolean;
}

/** The 6 x 7 grid of a month, padded with the neighbouring months. */
export type CalendarMatrix = MatrixCell[][];

/** First and last day the grid can focus. */
export interface GridBounds {
  first: ISODate;
  last: ISODate;
}

/** Both ends of a painted range; a missing side paints nothing. */
export interface PanelRange {
  start?: ISODate;
  end?: ISODate;
}

/** Everything `renderCalendarPanel` needs; the components own the state. */
export interface CalendarPanelOptions {
  /** Displayed month, 1-12. */
  month: number;
  /** Displayed year. */
  year: number;
  /** Weekday column 0 (0 = Sunday, 1 = Monday). */
  firstDay: 0 | 1;
  /** Endpoints painted as selected. */
  selected: readonly ISODate[];
  /** Range to paint, usually the pending selection plus the hovered day. */
  range: PanelRange | null;
  /** Day that owns the roving `tabindex`; `null` falls back to the first enabled day. */
  focused: ISODate | null;
  /** Earliest selectable day. */
  min?: ISODate;
  /** Latest selectable day. */
  max?: ISODate;
  /** Highlighted as today. */
  today: ISODate;
  /** Disables every day (the control itself is disabled or readonly). */
  blocked: boolean;
  /** Enables the clear button. */
  clear: boolean;
  /** Header title; defaults to `YYYY年M月`. */
  title?: string;
}

/** Escapes text that enters markup as an attribute value or a text node. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/** Local weekday index of `iso` (0 = Sunday); invalid input reads as Sunday. */
export function weekdayIndex(iso: ISODate): number {
  const parts = parseISO(iso);
  if (!parts) return 0;
  // Local fields only: the UTC-based `Date#getUTCDay()` would shift the day.
  return new Date(parts.year, parts.month - 1, parts.day).getDay();
}

/** First day of the week `iso` belongs to, using the same `firstDay` column. */
export function weekStart(iso: ISODate, firstDay: 0 | 1): ISODate {
  return addDays(iso, -((weekdayIndex(iso) - firstDay + 7) % 7));
}

/** Last day of the week `iso` belongs to, using the same `firstDay` column. */
export function weekEnd(iso: ISODate, firstDay: 0 | 1): ISODate {
  return addDays(iso, 6 - ((weekdayIndex(iso) - firstDay + 7) % 7));
}

/**
 * Renders a day through a display pattern: `YYYY`, `MM`, `M`, `DD` and `D` are
 * replaced, every other character is kept verbatim.
 */
export function formatDisplay(iso: ISODate, format: string): string {
  const parts = parseISO(iso);
  if (!parts) return '';
  const two = (value: number): string => String(value).padStart(2, '0');
  return format
    .replace(/YYYY/g, String(parts.year))
    .replace(/MM/g, two(parts.month))
    .replace(/DD/g, two(parts.day))
    .replace(/M/g, String(parts.month))
    .replace(/D/g, String(parts.day));
}

/** Header title of a month, e.g. `2026年11月`. */
export function monthTitle(year: number, month: number): string {
  return `${year}年${month}月`;
}

/** `true` when the day is outside `min`/`max` or the whole control is blocked. */
export function isBlockedDay(
  iso: ISODate,
  min: ISODate | undefined,
  max: ISODate | undefined,
  blocked: boolean,
): boolean {
  if (blocked) return true;
  if (min !== undefined && compareISO(iso, min) < 0) return true;
  if (max !== undefined && compareISO(iso, max) > 0) return true;
  return false;
}

/** First and last day of a rendered matrix. */
export function gridBounds(rows: CalendarMatrix): GridBounds {
  return { first: rows[0][0].iso, last: rows[rows.length - 1][6].iso };
}

/** Keeps `target` inside the grid and moves it forward to the nearest enabled day. */
export function nearestEnabled(
  target: ISODate,
  bounds: GridBounds,
  blocked: (iso: ISODate) => boolean,
): ISODate {
  let cursor = target;
  for (let step = 0; step < 42; step += 1) {
    if (!blocked(cursor)) return cursor;
    const next = addDays(cursor, 1);
    if (compareISO(next, bounds.last) > 0) break;
    cursor = next;
  }
  cursor = target;
  for (let step = 0; step < 42; step += 1) {
    if (!blocked(cursor)) return cursor;
    const next = addDays(cursor, -1);
    if (compareISO(next, bounds.first) < 0) break;
    cursor = next;
  }
  return target;
}

/**
 * Moves the roving focus by `delta` days, staying inside the grid and skipping
 * blocked days in the direction of travel.
 */
export function stepFocus(
  current: ISODate,
  delta: number,
  bounds: GridBounds,
  blocked: (iso: ISODate) => boolean,
): ISODate {
  const direction = delta >= 0 ? 1 : -1;
  let target = addDays(current, delta);
  if (compareISO(target, bounds.first) < 0) target = bounds.first;
  if (compareISO(target, bounds.last) > 0) target = bounds.last;
  for (let step = 0; step < 42; step += 1) {
    if (!blocked(target)) return target;
    const next = addDays(target, direction);
    if (compareISO(next, bounds.first) < 0 || compareISO(next, bounds.last) > 0) break;
    target = next;
  }
  return current;
}

/** The day that owns `tabindex="0"`: the requested one, else the first enabled cell. */
export function resolveFocus(
  rows: CalendarMatrix,
  focused: ISODate | null,
  blocked: (iso: ISODate) => boolean,
): ISODate | null {
  const cells = rows.flat();
  const wanted = cells.find((cell) => cell.iso === focused);
  if (wanted && !blocked(wanted.iso)) return wanted.iso;
  const fallback = cells.find((cell) => !blocked(cell.iso));
  return fallback ? fallback.iso : null;
}

/** Orders and validates the painted range; a single side paints one cell. */
function normalizeRange(range: PanelRange): { low: ISODate; high: ISODate } | null {
  const start = range.start !== undefined && isValidISO(range.start) ? range.start : '';
  const end = range.end !== undefined && isValidISO(range.end) ? range.end : '';
  if (start.length === 0 && end.length === 0) return null;
  if (start.length === 0) return { low: end, high: end };
  if (end.length === 0) return { low: start, high: start };
  return compareISO(start, end) <= 0 ? { low: start, high: end } : { low: end, high: start };
}

/** One day button, wrapped in its `gridcell`. */
function renderDay(
  cell: MatrixCell,
  options: CalendarPanelOptions,
  focus: ISODate | null,
  selected: ReadonlySet<string>,
  range: { low: ISODate; high: ISODate } | null,
  blocked: (iso: ISODate) => boolean,
): string {
  const { iso, inMonth } = cell;
  const parts = parseISO(iso);
  const classes = ['day'];
  const partNames = ['day'];
  if (!inMonth) {
    classes.push('day-outside');
    partNames.push('day-outside');
  }
  if (selected.has(iso)) {
    classes.push('day-selected');
    partNames.push('day-selected');
  }
  if (iso === options.today) {
    classes.push('day-today');
    partNames.push('day-today');
  }
  if (range !== null) {
    if (iso === range.low) classes.push('range-start');
    if (iso === range.high && range.high !== range.low) classes.push('range-end');
    if (compareISO(iso, range.low) > 0 && compareISO(iso, range.high) < 0) {
      classes.push('in-range');
    }
  }

  const disabled = blocked(iso);
  const label = parts === null
    ? iso
    : `${parts.year}年${parts.month}月${parts.day}日`;
  const attrs =
    ` data-iso="${iso}"` +
    ` tabindex="${iso === focus ? '0' : '-1'}"` +
    ` aria-label="${escapeHtml(label)}"` +
    (iso === options.today ? ' aria-current="date"' : '') +
    (disabled ? ' disabled aria-disabled="true"' : '');

  return (
    `<div class="cell" role="gridcell" aria-selected="${selected.has(iso) ? 'true' : 'false'}"` +
    `${disabled ? ' aria-disabled="true"' : ''}>` +
    `<button class="${classes.join(' ')}" part="${partNames.join(' ')}" type="button"${attrs}>` +
    `${parts === null ? '' : parts.day}` +
    `</button></div>`
  );
}

/**
 * Header, weekday row, 6 x 7 day grid and footer of one month.
 *
 * The result is the panel *body*: the owning component wraps it in its own
 * `part="panel"` element so it can toggle the popover and `hidden` state.
 */
export function renderCalendarPanel(options: CalendarPanelOptions): string {
  const blocked = (iso: ISODate): boolean =>
    isBlockedDay(iso, options.min, options.max, options.blocked);

  const rows = monthMatrix(options.year, options.month, options.firstDay);
  const focus = resolveFocus(rows, options.focused, blocked);
  const selected = new Set(options.selected);
  const range = options.range === null ? null : normalizeRange(options.range);
  const title = options.title ?? monthTitle(options.year, options.month);

  const weekdays =
    `<div class="row weekdays" role="row">` +
    weekdayLabels(options.firstDay)
      .map(
        (label) =>
          `<span class="weekday" part="weekday" role="columnheader"` +
          ` aria-label="周${label}">${label}</span>`,
      )
      .join('') +
    `</div>`;

  const gridRows = rows
    .map(
      (row) =>
        `<div class="row" role="row">${row
          .map((cell) => renderDay(cell, options, focus, selected, range, blocked))
          .join('')}</div>`,
    )
    .join('');

  const body =
    `<div class="header" part="header">` +
    `<button class="nav" part="nav-prev" data-focus="prev" type="button" aria-label="上个月">` +
    `<span aria-hidden="true">‹</span></button>` +
    `<div class="title" part="title" aria-live="polite">${escapeHtml(title)}</div>` +
    `<button class="nav" part="nav-next" data-focus="next" type="button" aria-label="下个月">` +
    `<span aria-hidden="true">›</span></button>` +
    `</div>` +
    `<div class="grid" part="grid" role="grid" aria-label="${escapeHtml(title)}">` +
    `${weekdays}${gridRows}` +
    `</div>` +
    `<div class="footer" part="footer">` +
    `<button class="footer-btn" part="clear" data-focus="clear" type="button"` +
    `${options.clear ? '' : ' disabled'}>清除</button>` +
    `<button class="footer-btn" part="today" data-focus="today" type="button"` +
    `${options.blocked ? ' disabled' : ''}>今天</button>` +
    `</div>`;

  return body;
}
