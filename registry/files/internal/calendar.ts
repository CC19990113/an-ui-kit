/**
 * Calendar arithmetic for date-based components.
 *
 * Pure functions only: this module never touches the DOM, so it is safe under
 * SSR and in workers. Every operation stays on local calendar fields
 * (`new Date(year, month - 1, day)`) and no `toISOString()` / UTC conversion is
 * involved, so a timezone offset can never move a day by one.
 */

/** Calendar day in `YYYY-MM-DD`. */
export type ISODate = string;

/** Shown in the weekday header, indexed by `Date#getDay()` (0 = Sunday). */
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Zero-pads to `length` digits; years shorter than 4 digits keep their sign. */
function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

/** Date fields as the components see them; `month` is 1-12. */
interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

/** Days in `month` (1-12) of `year`; `month` overflows into the next year. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Builds a local `Date`; `month` is 1-12, day overflow normalizes like `Date`. */
function toDate({ year, month, day }: CalendarParts): Date {
  const date = new Date(year, month - 1, day);
  // `new Date(0-99, ...)` maps the year to 1900-1999; keep a padded four-digit
  // year for what it says.
  if (year >= 0 && year < 100) date.setFullYear(year);
  return date;
}

/** Local date fields of a `Date`; never routes through UTC. */
function toParts(date: Date): CalendarParts {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/** Whether `value` is a real calendar day in `YYYY-MM-DD`. */
export function isValidISO(value: string): boolean {
  return parseISO(value) !== null;
}

/** Parses `YYYY-MM-DD` into local fields, or `null` when it is not a real day. */
export function parseISO(value: string): CalendarParts | null {
  const match = ISO_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Formats local fields as `YYYY-MM-DD` (`month` is 1-12). */
export function formatISO(value: CalendarParts): ISODate {
  return `${pad(value.year, 4)}-${pad(value.month, 2)}-${pad(value.day, 2)}`;
}

/** Today in the user's local timezone. */
export function todayISO(): ISODate {
  return formatISO(toParts(new Date()));
}

/** Shifts `iso` by `delta` days; an invalid input is returned unchanged. */
export function addDays(iso: ISODate, delta: number): ISODate {
  const parts = parseISO(iso);
  if (!parts) return iso;
  return formatISO(toParts(toDate({ ...parts, day: parts.day + delta })));
}

/** Shifts a year/month pair by `delta` months, carrying across year boundaries. */
export function addMonths(
  month: { year: number; month: number },
  delta: number,
): { year: number; month: number } {
  const index = month.year * 12 + (month.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

/**
 * The 6 x 7 day grid of a month, padded with the neighbouring months.
 * `firstDay` is the weekday column 0 (0 = Sunday, 1 = Monday).
 */
export function monthMatrix(
  year: number,
  month: number,
  firstDay: 0 | 1,
): Array<Array<{ iso: ISODate; inMonth: boolean }>> {
  const weekday = toDate({ year, month, day: 1 }).getDay();
  const offset = (weekday - firstDay + 7) % 7;
  const start = 1 - offset;
  const rows: Array<Array<{ iso: ISODate; inMonth: boolean }>> = [];

  for (let row = 0; row < 6; row += 1) {
    const week: Array<{ iso: ISODate; inMonth: boolean }> = [];
    for (let column = 0; column < 7; column += 1) {
      const date = toDate({ year, month, day: start + row * 7 + column });
      week.push({ iso: formatISO(toParts(date)), inMonth: date.getMonth() === month - 1 });
    }
    rows.push(week);
  }
  return rows;
}

/** Weekday header labels, rotated so column 0 matches `firstDay`. */
export function weekdayLabels(firstDay: 0 | 1): string[] {
  return Array.from({ length: 7 }, (_, index) => WEEKDAY_LABELS[(firstDay + index) % 7]);
}

/** Order-sensitive comparison of two ISO days: `-1`, `0` or `1`. */
export function compareISO(a: ISODate, b: ISODate): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Clamps `value` into `[min, max]`; undefined bounds are ignored. */
export function clampISO(value: ISODate, min?: ISODate, max?: ISODate): ISODate {
  let result = value;
  if (min !== undefined && compareISO(result, min) < 0) result = min;
  if (max !== undefined && compareISO(result, max) > 0) result = max;
  return result;
}
