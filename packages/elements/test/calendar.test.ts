/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  clampISO,
  compareISO,
  formatISO,
  isValidISO,
  monthMatrix,
  parseISO,
  todayISO,
  weekdayLabels,
} from '../src/internal/calendar';

describe('calendar ISO parsing', () => {
  it('accepts real calendar days', () => {
    expect(isValidISO('2026-11-19')).toBe(true);
    expect(isValidISO('2024-02-29')).toBe(true);
  });

  it('rejects malformed and impossible days', () => {
    expect(isValidISO('')).toBe(false);
    expect(isValidISO('2026-11-19T00:00:00Z')).toBe(false);
    expect(isValidISO('2026-1-5')).toBe(false);
    expect(isValidISO('2026-13-01')).toBe(false);
    expect(isValidISO('2026-00-01')).toBe(false);
    expect(isValidISO('2026-02-30')).toBe(false);
    expect(isValidISO('2025-02-29')).toBe(false);
  });

  it('parses into one-based month fields', () => {
    expect(parseISO('2026-01-05')).toEqual({ year: 2026, month: 1, day: 5 });
    expect(parseISO('2026-12-31')).toEqual({ year: 2026, month: 12, day: 31 });
    expect(parseISO('2026-02-30')).toBeNull();
  });

  it('formats with zero padding', () => {
    expect(formatISO({ year: 2026, month: 1, day: 5 })).toBe('2026-01-05');
    expect(formatISO({ year: 999, month: 12, day: 31 })).toBe('0999-12-31');
  });

  it('formats today from local fields', () => {
    const now = new Date();
    const expected = [
      String(now.getFullYear()).padStart(4, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    expect(todayISO()).toBe(expected);
  });
});

describe('calendar arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-19', 1)).toBe('2026-11-20');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('leaves an invalid day untouched', () => {
    expect(addDays('not-a-day', 1)).toBe('not-a-day');
    expect(addDays('2026-02-30', 1)).toBe('2026-02-30');
  });

  it('adds months with year carry in both directions', () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 5 }, 13)).toEqual({ year: 2027, month: 6 });
    expect(addMonths({ year: 2026, month: 2 }, -13)).toEqual({ year: 2025, month: 1 });
  });
});

describe('calendar month grid', () => {
  it('builds six weeks of seven days starting on Monday', () => {
    const weeks = monthMatrix(2026, 11, 1);

    expect(weeks).toHaveLength(6);
    for (const week of weeks) expect(week).toHaveLength(7);
    expect(weeks[0][0]).toEqual({ iso: '2026-10-26', inMonth: false });
    expect(weeks[5][6]).toEqual({ iso: '2026-12-06', inMonth: false });
    expect(weeks.flat().filter((cell) => cell.inMonth)).toHaveLength(30);
  });

  it('starts on Sunday when firstDay is 0', () => {
    const weeks = monthMatrix(2026, 11, 0);

    expect(weeks[0][0]).toEqual({ iso: '2026-11-01', inMonth: true });
    expect(weeks.flat().filter((cell) => cell.inMonth)).toHaveLength(30);
  });

  it('keeps six rows for a short month', () => {
    const weeks = monthMatrix(2026, 2, 1);

    expect(weeks).toHaveLength(6);
    expect(weeks.flat().filter((cell) => cell.inMonth)).toHaveLength(28);
  });

  it('rotates the weekday header for the first column', () => {
    expect(weekdayLabels(1)).toEqual(['一', '二', '三', '四', '五', '六', '日']);
    expect(weekdayLabels(0)).toEqual(['日', '一', '二', '三', '四', '五', '六']);
  });
});

describe('calendar comparison and clamping', () => {
  it('compares ISO days in order', () => {
    expect(compareISO('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareISO('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareISO('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('clamps into the given bounds', () => {
    expect(clampISO('2026-01-01', '2026-02-01', '2026-03-01')).toBe('2026-02-01');
    expect(clampISO('2026-04-01', '2026-02-01', '2026-03-01')).toBe('2026-03-01');
    expect(clampISO('2026-02-15', '2026-02-01', '2026-03-01')).toBe('2026-02-15');
  });

  it('leaves the value alone without bounds', () => {
    expect(clampISO('2026-02-15')).toBe('2026-02-15');
    expect(clampISO('2026-02-15', '2026-03-01')).toBe('2026-03-01');
    expect(clampISO('2026-02-15', undefined, '2026-01-01')).toBe('2026-01-01');
  });
});
