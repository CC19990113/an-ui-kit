/** @vitest-environment happy-dom */
// The shim installs before the element is defined, so the constructor's
// `attachInternals()` call finds it. Static imports are evaluated in order.
import './helpers/form-internals';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AnDateRange } from '../src/date/an-date-range';
import { componentSuite } from './helpers/harness';
import { internalsState } from './helpers/form-internals';

// `<an-date-range>` is not exported from `src/index.ts` yet, so this suite
// registers it itself; the guard keeps the file safe if that changes.
if (!customElements.get('an-date-range')) customElements.define('an-date-range', AnDateRange);

const CSS_VARS = [
  '--an-date-range-height',
  '--an-date-range-bg',
  '--an-date-range-fg',
  '--an-date-range-border-color',
  '--an-date-range-radius',
  '--an-date-range-font-size',
  '--an-date-range-padding-x',
  '--an-date-range-focus-ring',
  '--an-date-range-muted-fg',
  '--an-date-range-panel-bg',
  '--an-date-range-panel-fg',
  '--an-date-range-panel-border-color',
  '--an-date-range-panel-radius',
  '--an-date-range-panel-shadow',
  '--an-date-range-day-size',
  '--an-date-range-day-hover-bg',
  '--an-date-range-day-selected-bg',
  '--an-date-range-day-selected-fg',
  '--an-date-range-in-range-bg',
  '--an-date-range-today-ring',
];

/** March 2026 is fully rendered with `first-day=1`. */
const START = '2026-03-15';
const MID = '2026-03-18';
const END = '2026-03-20';

function mount(attributes: Record<string, string> = {}): AnDateRange {
  const element = document.createElement('an-date-range') as AnDateRange;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
}

function input(element: AnDateRange): HTMLInputElement {
  return element.shadowRoot!.querySelector<HTMLInputElement>('input')!;
}

function trigger(element: AnDateRange): HTMLElement {
  return element.shadowRoot!.querySelector<HTMLElement>('[part~="trigger"]')!;
}

function panel(element: AnDateRange): HTMLElement {
  return element.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
}

function title(element: AnDateRange): string {
  return element.shadowRoot!.querySelector('[part~="title"]')!.textContent ?? '';
}

function day(element: AnDateRange, iso: string): HTMLButtonElement | null {
  return element.shadowRoot!.querySelector<HTMLButtonElement>(`button[data-iso="${iso}"]`);
}

function days(element: AnDateRange): HTMLButtonElement[] {
  return [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('button[data-iso]')];
}

function openPanel(element: AnDateRange): void {
  trigger(element).click();
}

function press(target: EventTarget, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
}

function hover(target: Element, type: 'pointerover' | 'pointerout'): void {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true }));
}

/** Collects `an-date-range-change` details. */
function track(element: AnDateRange): Array<{ start: string; end: string }> {
  const seen: Array<{ start: string; end: string }> = [];
  element.addEventListener('an-date-range-change', (event) => {
    seen.push((event as CustomEvent<{ start: string; end: string }>).detail);
  });
  return seen;
}

function todayLocal(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

componentSuite({
  tag: 'an-date-range',
  ctor: AnDateRange,
  defaults: AnDateRange.defaults,
  events: ['an-date-range-change', 'an-date-range-open', 'an-date-range-close'],
  cssVars: CSS_VARS,
  parts: [
    'base',
    'label',
    'trigger',
    'input',
    'panel',
    'header',
    'title',
    'nav-prev',
    'nav-next',
    'grid',
    'weekday',
    'day',
    'footer',
    'clear',
    'today',
  ],
});

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('an-date-range — structure and a11y', () => {
  it('renders a combobox trigger with the default range placeholder', () => {
    const element = mount();
    const field = input(element);

    expect(field.getAttribute('role')).toBe('combobox');
    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(field.getAttribute('placeholder')).toBe('开始日期 — 结束日期');
    expect(panel(element).hidden).toBe(true);
    expect(panel(element).getAttribute('role')).toBe('dialog');
    expect(element.shadowRoot!.querySelector('[part~="grid"]')!.getAttribute('role')).toBe('grid');
    expect(days(element)).toHaveLength(42);
    expect(element.shadowRoot!.querySelectorAll('[role="gridcell"]')).toHaveLength(42);
  });

  it('shows both endpoints through the trigger text', () => {
    const complete = mount({ start: START, end: END });
    const single = mount({ start: START });

    expect(input(complete).value).toBe(`${START} — ${END}`);
    expect(input(single).value).toBe(START);
  });

  it('marks both endpoints as selected gridcells', () => {
    const element = mount({ start: START, end: END });
    openPanel(element);
    const cell = (iso: string): Element | null =>
      day(element, iso)!.closest('[role="gridcell"]')!;

    expect(cell(START).getAttribute('aria-selected')).toBe('true');
    expect(cell(END).getAttribute('aria-selected')).toBe('true');
    expect(cell(MID).getAttribute('aria-selected')).toBe('false');
    expect(day(element, START)!.classList.contains('range-start')).toBe(true);
    expect(day(element, END)!.classList.contains('range-end')).toBe(true);
    expect(day(element, MID)!.classList.contains('in-range')).toBe(true);
    const outside = element.shadowRoot!.querySelector('[part~="day-outside"]')!;
    expect(outside.classList.contains('day-outside')).toBe(true);
    expect(AnDateRange.styles).toMatch(/\.day\.day-outside\s*\{[^}]*--an-date-muted-fg/);
    expect(AnDateRange.styles).toMatch(
      /:host\(an-date-range\)[^{]*\.day-outside[^{]*\{[^}]*--an-date-range-muted-fg/,
    );
  });

  it('orders the endpoints coming from attributes', () => {
    const element = mount({ start: END, end: START });

    expect(element.start).toBe(START);
    expect(element.end).toBe(END);
  });
});

describe('an-date-range — picking', () => {
  it('takes the first click as the start and keeps the panel open', () => {
    const element = mount({ start: START });
    const changes = track(element);
    openPanel(element);

    day(element, START)!.click();

    expect(element.start).toBe(START);
    expect(element.end).toBe('');
    expect(changes).toHaveLength(0);
    expect(panel(element).hidden).toBe(false);
    expect(day(element, START)!.classList.contains('range-start')).toBe(true);
  });

  it('completes on the second click and emits the sorted range', () => {
    const element = mount({ start: START });
    const changes = track(element);
    openPanel(element);

    day(element, START)!.click();
    day(element, MID)!.click();

    expect(element.start).toBe(START);
    expect(element.end).toBe(MID);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ start: START, end: MID });
    expect(input(element).value).toBe(`${START} — ${MID}`);
    expect(panel(element).hidden).toBe(true);
  });

  it('swaps the pair when the second click is earlier', () => {
    const element = mount({ start: END });
    const changes = track(element);
    openPanel(element);

    day(element, END)!.click();
    day(element, START)!.click();

    expect(element.start).toBe(START);
    expect(element.end).toBe(END);
    expect(changes[0]).toEqual({ start: START, end: END });
  });

  it('accepts the same day for both endpoints', () => {
    const element = mount({ start: START });
    const changes = track(element);
    openPanel(element);

    day(element, START)!.click();
    day(element, START)!.click();

    expect(element.start).toBe(START);
    expect(element.end).toBe(START);
    expect(changes[0]).toEqual({ start: START, end: START });
  });

  it('previews the pending range on hover and clears it on pointerout', () => {
    const element = mount({ start: START });
    openPanel(element);
    day(element, START)!.click();

    hover(day(element, END)!, 'pointerover');

    expect(day(element, START)!.classList.contains('range-start')).toBe(true);
    expect(day(element, END)!.classList.contains('range-end')).toBe(true);
    expect(day(element, MID)!.classList.contains('in-range')).toBe(true);
    expect(day(element, '2026-03-16')!.classList.contains('in-range')).toBe(true);

    hover(day(element, END)!, 'pointerout');

    expect(day(element, END)!.classList.contains('range-end')).toBe(false);
    expect(day(element, MID)!.classList.contains('in-range')).toBe(false);
    expect(day(element, START)!.classList.contains('range-start')).toBe(true);
  });

  it('keeps the committed range painted after re-opening the panel', () => {
    const element = mount({ start: START, end: END });
    openPanel(element);

    expect(day(element, MID)!.classList.contains('in-range')).toBe(true);
    expect(day(element, START)!.classList.contains('range-start')).toBe(true);
    expect(day(element, END)!.classList.contains('range-end')).toBe(true);
  });

  it('disables days outside min and max', () => {
    const element = mount({ start: START, end: END, min: '2026-03-10', max: '2026-03-20' });
    openPanel(element);

    expect(day(element, '2026-03-09')!.disabled).toBe(true);
    expect(day(element, '2026-03-21')!.disabled).toBe(true);
    day(element, '2026-03-21')!.click();

    expect(element.start).toBe(START);
    expect(element.end).toBe(END);
  });

  it('starts a new range from the today footer button', () => {
    const element = mount({ start: START, end: END });
    openPanel(element);

    element.shadowRoot!.querySelector<HTMLElement>('[part~="today"]')!.click();

    expect(element.start).toBe(todayLocal());
    expect(element.end).toBe('');
    expect(panel(element).hidden).toBe(false);
  });

  it('clears both endpoints and emits an empty range', () => {
    const element = mount({ start: START, end: END });
    const changes = track(element);
    openPanel(element);

    element.shadowRoot!.querySelector<HTMLElement>('[part~="clear"]')!.click();

    expect(element.start).toBe('');
    expect(element.end).toBe('');
    expect(changes[0]).toEqual({ start: '', end: '' });
    expect(
      element.shadowRoot!.querySelector<HTMLButtonElement>('[part~="clear"]')!.disabled,
    ).toBe(true);
    expect(input(element).value).toBe('');
  });

  it('does not open or pick while disabled', () => {
    const element = mount({ start: START, end: END, disabled: '' });

    trigger(element).click();
    expect(element.isOpen).toBe(false);
    expect(panel(element).hidden).toBe(true);

    day(element, MID)!.click();
    expect(element.start).toBe(START);
    expect(element.end).toBe(END);
  });
});

describe('an-date-range — controlled open state', () => {
  it('reflects the open property and emits the panel events', () => {
    const element = mount({ start: START, end: END });
    const opened: Event[] = [];
    const closed: Event[] = [];
    element.addEventListener('an-date-range-open', (event) => opened.push(event));
    element.addEventListener('an-date-range-close', (event) => closed.push(event));

    expect(element.open).toBe(false);

    element.show();
    expect(element.open).toBe(true);
    expect(element.hasAttribute('open')).toBe(true);
    expect(element.isOpen).toBe(true);
    expect(panel(element).hidden).toBe(false);
    expect(opened).toHaveLength(1);

    element.toggle();
    expect(element.open).toBe(false);
    expect(element.isOpen).toBe(false);
    expect(panel(element).hidden).toBe(true);
    expect(closed).toHaveLength(1);

    element.setAttribute('open', '');
    expect(element.open).toBe(true);
    element.close();
    expect(element.open).toBe(false);
    expect(closed).toHaveLength(2);
  });

  it('forces open back to false while disabled', () => {
    const element = mount({ start: START, end: END, disabled: '' });

    element.open = true;

    expect(element.open).toBe(false);
    expect(element.hasAttribute('open')).toBe(false);
    expect(panel(element).hidden).toBe(true);
  });
});

describe('an-date-range — keyboard', () => {
  it('moves focus with the arrows and picks both ends with Enter', () => {
    const element = mount({ start: START, end: END });
    const changes = track(element);
    openPanel(element);

    press(input(element), 'ArrowDown');
    expect(element.shadowRoot!.activeElement).toBe(day(element, START));

    press(day(element, START)!, 'ArrowRight');
    expect((element.shadowRoot!.activeElement as HTMLElement).dataset.iso).toBe('2026-03-16');

    press(day(element, '2026-03-16')!, 'Enter');
    expect(element.start).toBe('2026-03-16');
    expect(element.end).toBe('');
    expect(panel(element).hidden).toBe(false);

    press(day(element, '2026-03-16')!, 'ArrowRight');
    press(day(element, '2026-03-17')!, 'Enter');

    expect(changes[0]).toEqual({ start: '2026-03-16', end: '2026-03-17' });
    expect(panel(element).hidden).toBe(true);
  });

  it('pages through months during keyboard picking', () => {
    const element = mount({ start: START, end: END });
    openPanel(element);

    press(input(element), 'ArrowDown');
    press(day(element, START)!, 'PageDown');

    expect(title(element)).toBe('2026年4月');
    expect((element.shadowRoot!.activeElement as HTMLElement).dataset.iso).toBe('2026-04-15');

    press(day(element, '2026-04-15')!, 'PageUp');
    expect(title(element)).toBe('2026年3月');
  });

  it('closes with Escape and returns focus to the trigger', () => {
    const element = mount({ start: START, end: END });
    openPanel(element);
    press(input(element), 'ArrowDown');

    press(day(element, START)!, 'Escape');

    expect(panel(element).hidden).toBe(true);
    expect(element.shadowRoot!.activeElement).toBe(input(element));
  });
});

describe('an-date-range — form integration', () => {
  it('submits both fields once the range is complete', () => {
    document.body.innerHTML =
      `<form><an-date-range name="from" end-name="to" start="${START}" end="${END}"></an-date-range></form>`;
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-date-range') as AnDateRange;

    expect(new FormData(form).get('from')).toBe(START);
    expect(new FormData(form).get('to')).toBe(END);
  });

  it('submits neither field while the range is incomplete', () => {
    document.body.innerHTML =
      `<form><an-date-range name="from" end-name="to" start="${START}"></an-date-range></form>`;
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-date-range') as AnDateRange;
    const fields = [...element.querySelectorAll<HTMLInputElement>('input[type="hidden"]')];

    expect(fields).toHaveLength(2);
    expect(fields.every((field) => field.disabled)).toBe(true);
    expect(new FormData(form).has('from')).toBe(false);
    expect(new FormData(form).has('to')).toBe(false);
  });

  it('exposes both rows through its own FormData snapshot', () => {
    const element = mount({ name: 'from', 'end-name': 'to', start: START, end: END });
    const data = element.getFormData()!;

    expect(data.get('from')).toBe(START);
    expect(data.get('to')).toBe(END);

    element.start = '';
    expect(element.getFormData()).toBeNull();
  });

  it('reports valueMissing until both ends exist', () => {
    document.body.innerHTML = '<form><an-date-range required name="from" end-name="to"></an-date-range></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-date-range') as AnDateRange;

    expect(internalsState(element)!.flags).toMatchObject({ valueMissing: true });
    expect(internalsState(element)!.message).toBe('此字段为必填项。');
    expect(internalsState(element)!.anchor).toBe(input(element));

    const submits: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });
    form.requestSubmit();
    expect(submits).toHaveLength(0);

    element.start = START;
    expect(internalsState(element)!.flags).toMatchObject({ valueMissing: true });

    element.end = END;
    expect(internalsState(element)!.flags).toEqual({});
    form.requestSubmit();
    expect(submits).toHaveLength(1);
  });

  it('restores the mounted range on form reset', () => {
    document.body.innerHTML =
      `<form><an-date-range name="from" end-name="to" start="${START}" end="${END}"></an-date-range></form>`;
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-date-range') as AnDateRange;

    element.start = '2026-09-01';
    element.end = '2026-09-09';
    form.reset();

    expect(element.start).toBe(START);
    expect(element.end).toBe(END);
    expect(new FormData(form).get('from')).toBe(START);
    expect(new FormData(form).get('to')).toBe(END);
  });
});

describe('an-date-range — inline mode', () => {
  it('renders a permanent panel without a trigger and picks inline', () => {
    const element = mount({ inline: '', start: START });
    const changes = track(element);

    expect(element.shadowRoot!.querySelector('[part~="trigger"]')).toBeNull();
    expect(element.shadowRoot!.querySelector('[part~="input"]')).toBeNull();
    expect(panel(element).hidden).toBe(false);
    expect(days(element)).toHaveLength(42);

    day(element, MID)!.click();
    day(element, END)!.click();

    expect(element.start).toBe(MID);
    expect(element.end).toBe(END);
    expect(changes[0]).toEqual({ start: MID, end: END });
    expect(panel(element).hidden).toBe(false);
  });

  it('renders the weekday header in `first-day` order', () => {
    const monday = mount({ start: START });
    const sunday = mount({ start: START, 'first-day': '0' });
    const labels = (element: AnDateRange): string[] =>
      [...element.shadowRoot!.querySelectorAll('[part~="weekday"]')].map(
        (cell) => cell.textContent ?? '',
      );

    expect(labels(monday)).toEqual(['一', '二', '三', '四', '五', '六', '日']);
    expect(labels(sunday)).toEqual(['日', '一', '二', '三', '四', '五', '六']);
  });
});

// ---------------------------------------------------------------------------
// `presets`: the shortcut rail at the bottom of the panel.
// ---------------------------------------------------------------------------

const PRESETS = [
  { label: '近 7 天', start: '2026-03-14', end: '2026-03-20' },
  { label: '本月', start: '2026-03-01', end: '2026-03-31' },
];

function presetButtons(element: AnDateRange): HTMLButtonElement[] {
  return [
    ...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="preset"]'),
  ];
}

function presetBar(element: AnDateRange): HTMLElement | null {
  return element.shadowRoot!.querySelector<HTMLElement>('[part~="presets"]');
}

function clickPreset(element: AnDateRange, index: number): void {
  presetButtons(element)[index].click();
}

function changesOf(element: AnDateRange): CustomEvent[] {
  const seen: CustomEvent[] = [];
  element.addEventListener('an-date-range-change', (event) => seen.push(event as CustomEvent));
  return seen;
}

describe('an-date-range — presets property', () => {
  it('renders one `part="preset"` button per entry, in a labelled rail', () => {
    const element = mount();
    element.presets = PRESETS;
    openPanel(element);

    const rail = presetBar(element);
    expect(rail).not.toBeNull();
    expect(rail!.getAttribute('role')).toBe('group');
    expect(rail!.getAttribute('aria-label')).toBe('快捷预设');

    const buttons = presetButtons(element);
    expect(buttons).toHaveLength(2);
    expect(buttons.map((button) => button.textContent)).toEqual(['近 7 天', '本月']);
    for (const button of buttons) {
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('type')).toBe('button');
      expect(button.getAttribute('part')).toBe('preset');
    }
    expect(buttons.map((button) => button.dataset.presetIndex)).toEqual(['0', '1']);
  });

  it('renders the presets inside the panel, after the calendar body', () => {
    const element = mount();
    element.presets = PRESETS;
    openPanel(element);

    const rail = presetBar(element);
    expect(rail!.closest('[part~="panel"]')).toBe(panel(element));
    // The rail is the panel's last child, i.e. paints below the calendar.
    expect(panel(element).lastElementChild).toBe(rail);
  });

  it('renders nothing at all when the list is empty', () => {
    const element = mount({ presets: '[]' });
    openPanel(element);

    expect(presetBar(element)).toBeNull();
    expect(presetButtons(element)).toHaveLength(0);
  });
});

describe('an-date-range — applying a preset', () => {
  it('writes both endpoints, emits the range and keeps the change payload small', () => {
    const element = mount();
    element.presets = PRESETS;
    const seen = changesOf(element);
    openPanel(element);

    clickPreset(element, 0);

    expect(element.start).toBe('2026-03-14');
    expect(element.end).toBe('2026-03-20');
    expect(seen).toHaveLength(1);
    expect(seen[0].detail).toEqual({ start: '2026-03-14', end: '2026-03-20' });
  });

  it('closes the panel after applying a preset', () => {
    const element = mount();
    element.presets = PRESETS;
    openPanel(element);
    expect(element.open).toBe(true);

    clickPreset(element, 1);

    expect(element.open).toBe(false);
    expect(element.hasAttribute('open')).toBe(false);
    expect(panel(element).hasAttribute('hidden')).toBe(true);
    // `aria-expanded` lives on the inner combobox input, not on the wrapper.
    const input = element.shadowRoot!.querySelector('[part~="input"]')!;
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('role')).toBe('combobox');
    expect(element.end).toBe('2026-03-31');
  });

  it('keeps the panel in flow in inline mode', () => {
    const element = document.createElement('an-date-range') as AnDateRange;
    element.setAttribute('inline', '');
    element.presets = PRESETS;
    document.body.append(element);

    // Inline panels are permanent: `show()` / `close()` are no-ops and the
    // panel never carries `hidden`. That is the observable "stays open" state.
    expect(panel(element).hasAttribute('hidden')).toBe(false);

    clickPreset(element, 0);

    expect(element.start).toBe('2026-03-14');
    expect(element.end).toBe('2026-03-20');
    expect(panel(element).hasAttribute('hidden')).toBe(false);
    // `open` stays false in inline mode, and `close()` must not flip it.
    expect(element.open).toBe(false);
  });

  it('paints the applied range as selected days', () => {
    const element = mount();
    element.presets = PRESETS;
    openPanel(element);

    clickPreset(element, 1);

    // The panel closed, so reopen it to read the painted state.
    openPanel(element);
    // `aria-selected` lives on the `role="gridcell"` wrapper, the button is
    // only its visual face.
    const selected = (iso: string): string | null =>
      day(element, iso)!.closest('[role="gridcell"]')!.getAttribute('aria-selected');
    expect(selected('2026-03-01')).toBe('true');
    expect(selected('2026-03-31')).toBe('true');
    expect(selected('2026-03-15')).toBe('false');
    expect(day(element, '2026-03-01')!.getAttribute('part')).toContain('day-selected');
    expect(day(element, '2026-03-31')!.getAttribute('part')).toContain('day-selected');
    expect(title(element)).toBe('2026年3月');
  });

  it('applies the endpoints in one step, never a half-open range', () => {
    const element = mount();
    element.presets = PRESETS;
    const seen = changesOf(element);
    openPanel(element);

    clickPreset(element, 0);

    // One event, not one per endpoint: a preset is a single committed range.
    expect(seen).toHaveLength(1);
    expect(element.start).not.toBe('');
    expect(element.end).not.toBe('');
  });
});

describe('an-date-range — preset bounds', () => {
  it.each([
    { start: '2026-10-01', end: '2026-10-31' },
    { start: '2026-10-31', end: '2026-11-20' },
    { start: '2026-11-10', end: '2026-12-01' },
  ])('blocks selecting $start — $end and preserves the submitted range', (preset) => {
    document.body.innerHTML =
      '<form><an-date-range required name="from" end-name="to" ' +
      'min="2026-11-01" max="2026-11-30" start="2026-11-10" end="2026-11-20">' +
      '</an-date-range></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-date-range') as AnDateRange;
    element.presets = [{ label: '快捷区间', ...preset }];
    const seen = changesOf(element);
    openPanel(element);

    clickPreset(element, 0);

    expect(Object.fromEntries(new FormData(form))).toEqual({
      from: '2026-11-10',
      to: '2026-11-20',
    });
    expect(presetButtons(element)[0].disabled).toBe(true);
    expect(element.applyPreset(0)).toBeUndefined();
    expect(element.start).toBe('2026-11-10');
    expect(element.end).toBe('2026-11-20');
    expect(Object.fromEntries(new FormData(form))).toEqual({
      from: '2026-11-10',
      to: '2026-11-20',
    });
    expect(element.checkValidity()).toBe(true);
    expect(element.open).toBe(true);
    expect(seen).toHaveLength(0);
  });

  it('rechecks changed bounds and allows endpoints equal to min and max', () => {
    const element = mount({ min: '2026-11-01', max: '2026-11-30' });
    const preset = { label: '十一月', start: '2026-11-01', end: '2026-11-30' };
    element.presets = [preset];
    const seen = track(element);
    openPanel(element);
    expect(presetButtons(element)[0].disabled).toBe(false);

    element.min = '2026-11-02';
    expect(presetButtons(element)[0].disabled).toBe(true);
    expect(element.applyPreset(0)).toBeUndefined();
    element.min = preset.start;
    expect(presetButtons(element)[0].disabled).toBe(false);

    element.setAttribute('max', '2026-11-29');
    expect(presetButtons(element)[0].disabled).toBe(true);
    expect(element.applyPreset(0)).toBeUndefined();
    expect(seen).toHaveLength(0);
    expect(element.start).toBe('');
    expect(element.end).toBe('');

    element.setAttribute('max', preset.end);
    expect(presetButtons(element)[0].disabled).toBe(false);
    clickPreset(element, 0);
    expect(seen).toEqual([{ start: preset.start, end: preset.end }]);
  });

  it('ignores invalid bounds just like the calendar grid', () => {
    const element = mount({ inline: '', min: '2026-12-32', max: '2026-10-00' });
    element.presets = [{ label: '十一月', start: '2026-11-01', end: '2026-11-30' }];

    expect(presetButtons(element)[0].disabled).toBe(false);
    clickPreset(element, 0);
    expect(element.start).toBe('2026-11-01');
    expect(element.end).toBe('2026-11-30');
  });
});

describe('an-date-range — presets attribute', () => {
  it('parses the JSON attribute into the same rail', () => {
    const element = mount({ presets: JSON.stringify(PRESETS) });
    openPanel(element);

    const buttons = presetButtons(element);
    expect(buttons).toHaveLength(2);
    expect(buttons.map((button) => button.textContent)).toEqual(['近 7 天', '本月']);
    expect(element.presets).toEqual([
      { label: '近 7 天', start: '2026-03-14', end: '2026-03-20' },
      { label: '本月', start: '2026-03-01', end: '2026-03-31' },
    ]);
  });

  it('parses the attribute set before the element is connected', () => {
    const element = document.createElement('an-date-range') as AnDateRange;
    element.setAttribute('presets', JSON.stringify([PRESETS[0]]));
    document.body.append(element);
    openPanel(element);

    expect(presetButtons(element)).toHaveLength(1);
    expect(presetButtons(element)[0].textContent).toBe('近 7 天');
  });

  it('keeps malformed JSON from throwing and keeps the previous presets', () => {
    const element = mount({ presets: JSON.stringify(PRESETS) });
    openPanel(element);
    expect(presetButtons(element)).toHaveLength(2);

    expect(() => element.setAttribute('presets', '{not json')).not.toThrow();

    // The malformed value is ignored instead of clearing the rail.
    expect(element.getAttribute('presets')).toBe('{not json');
    expect(element.presets).toHaveLength(2);
    expect(presetButtons(element)).toHaveLength(2);
  });

  it('drops entries whose dates cannot be parsed and sorts a reversed pair', () => {
    const element = mount({
      presets: JSON.stringify([
        { label: '坏的', start: 'not-a-date', end: '2026-03-20' },
        { label: '倒序', start: '2026-03-20', end: '2026-03-10' },
        { start: '2026-03-01', end: '2026-03-02' },
      ]),
    });
    openPanel(element);

    const labels = presetButtons(element).map((button) => button.textContent);
    // The invalid entry is gone; the reversed one is sorted; the unlabelled one
    // gets a generated "start — end" name.
    expect(labels).toEqual(['倒序', '2026-03-01 — 2026-03-02']);
    expect(element.presets[0]).toEqual({
      label: '倒序',
      start: '2026-03-10',
      end: '2026-03-20',
    });
  });
});
