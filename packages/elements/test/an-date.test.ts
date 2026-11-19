/** @vitest-environment happy-dom */
// The shim installs before the element is defined, so the constructor's
// `attachInternals()` call finds it. Static imports are evaluated in order.
import './helpers/form-internals';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AnDate } from '../src/date/an-date';
import { componentSuite } from './helpers/harness';
import { internalsState } from './helpers/form-internals';

// `<an-date>` is not exported from `src/index.ts` yet, so this suite registers
// it itself; the guard keeps the file safe if that registration lands later.
if (!customElements.get('an-date')) customElements.define('an-date', AnDate);

const CSS_VARS = [
  '--an-date-height',
  '--an-date-bg',
  '--an-date-fg',
  '--an-date-border-color',
  '--an-date-radius',
  '--an-date-font-size',
  '--an-date-padding-x',
  '--an-date-focus-ring',
  '--an-date-muted-fg',
  '--an-date-panel-bg',
  '--an-date-panel-fg',
  '--an-date-panel-border-color',
  '--an-date-panel-radius',
  '--an-date-panel-shadow',
  '--an-date-day-size',
  '--an-date-day-hover-bg',
  '--an-date-day-selected-bg',
  '--an-date-day-selected-fg',
  '--an-date-today-ring',
];

/** Fixed day used by the tests; its month is fully rendered. */
const DAY = '2026-03-15';

/** Mounts an `<an-date>` with the given attributes. */
function mount(attributes: Record<string, string> = {}): AnDate {
  const element = document.createElement('an-date') as AnDate;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
}

function input(element: AnDate): HTMLInputElement {
  return element.shadowRoot!.querySelector<HTMLInputElement>('input')!;
}

function trigger(element: AnDate): HTMLElement {
  return element.shadowRoot!.querySelector<HTMLElement>('[part~="trigger"]')!;
}

function panel(element: AnDate): HTMLElement {
  return element.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
}

function title(element: AnDate): string {
  return element.shadowRoot!.querySelector('[part~="title"]')!.textContent ?? '';
}

function day(element: AnDate, iso: string): HTMLButtonElement | null {
  return element.shadowRoot!.querySelector<HTMLButtonElement>(`button[data-iso="${iso}"]`);
}

function days(element: AnDate): HTMLButtonElement[] {
  return [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('button[data-iso]')];
}

function openPanel(element: AnDate): void {
  trigger(element).click();
}

/** Dispatches a keyboard event that crosses the shadow boundary. */
function press(target: EventTarget, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
}

/** Local calendar helpers, so no UTC conversion sneaks into the expectations. */
function shift(iso: string, days: number): string {
  const [year, month, dayOfMonth] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, dayOfMonth + days);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayLocal(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Collects `an-date-change` details. */
function track(element: AnDate): Array<{ value: string; originalEvent: Event }> {
  const seen: Array<{ value: string; originalEvent: Event }> = [];
  element.addEventListener('an-date-change', (event) => {
    seen.push((event as CustomEvent<{ value: string; originalEvent: Event }>).detail);
  });
  return seen;
}

componentSuite({
  tag: 'an-date',
  ctor: AnDate,
  defaults: AnDate.defaults,
  events: ['an-date-change', 'an-date-open', 'an-date-close'],
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

describe('an-date — structure and a11y', () => {
  it('renders a combobox trigger and a hidden dialog with a 6 x 7 grid', () => {
    const element = mount({ value: DAY });
    const field = input(element);

    expect(field.getAttribute('role')).toBe('combobox');
    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(field.getAttribute('aria-haspopup')).toBe('dialog');
    expect(panel(element).hidden).toBe(true);
    expect(panel(element).getAttribute('role')).toBe('dialog');
    expect(element.shadowRoot!.querySelector('[part~="grid"]')!.getAttribute('role')).toBe('grid');
    expect(element.shadowRoot!.querySelectorAll('[role="row"]')).toHaveLength(7);
    expect(element.shadowRoot!.querySelectorAll('[role="columnheader"]')).toHaveLength(7);
    expect(element.shadowRoot!.querySelectorAll('[role="gridcell"]')).toHaveLength(42);
    expect(days(element)).toHaveLength(42);
  });

  it('marks the selected day, today and outside days', () => {
    const element = mount({ value: DAY });
    openPanel(element);
    const selected = day(element, DAY)!;

    expect(selected.getAttribute('aria-selected')).toBeNull();
    expect(selected.closest('[role="gridcell"]')!.getAttribute('aria-selected')).toBe('true');
    expect(
      day(element, '2026-03-16')!.closest('[role="gridcell"]')!.getAttribute('aria-selected'),
    ).toBe('false');
    expect(selected.classList.contains('day-selected')).toBe(true);
    expect(element.shadowRoot!.querySelector('[part~="day-outside"]')).not.toBeNull();
    expect(element.shadowRoot!.querySelector('[part~="day-today"]')).toBeNull();

    const withToday = mount();
    openPanel(withToday);
    const today = day(withToday, todayLocal())!;
    expect(today.classList.contains('day-today')).toBe(true);
    expect(today.getAttribute('aria-current')).toBe('date');
  });

  it('exposes the roving tabindex on exactly one day', () => {
    const element = mount({ value: DAY });
    openPanel(element);
    const tabbable = days(element).filter((button) => button.tabIndex === 0);

    expect(tabbable).toHaveLength(1);
    expect(tabbable[0].dataset.iso).toBe(DAY);
  });

  it('renders the weekday header in `first-day` order', () => {
    const monday = mount({ value: DAY });
    const sunday = mount({ value: DAY, 'first-day': '0' });
    const labels = (element: AnDate): string[] =>
      [...element.shadowRoot!.querySelectorAll('[part~="weekday"]')].map(
        (cell) => cell.textContent ?? '',
      );

    expect(labels(monday)).toEqual(['一', '二', '三', '四', '五', '六', '日']);
    expect(labels(sunday)).toEqual(['日', '一', '二', '三', '四', '五', '六']);
  });
});

describe('an-date — value and formatting', () => {
  it('seeds the value from the attribute and formats it for display', () => {
    const element = mount({ value: DAY });

    expect(element.value).toBe(DAY);
    expect(input(element).value).toBe(DAY);

    const custom = mount({ value: DAY, format: 'YYYY/MM/DD' });
    expect(custom.value).toBe(DAY);
    expect(input(custom).value).toBe('2026/03/15');
  });

  it('ignores an invalid value attribute', () => {
    const element = mount({ value: '2026-02-30' });

    expect(element.value).toBe('');
    expect(input(element).value).toBe('');
  });

  it('updates from the property without writing the attribute back', () => {
    const element = mount({ value: DAY });

    element.value = '2026-10-10';

    expect(element.value).toBe('2026-10-10');
    expect(element.getAttribute('value')).toBe(DAY);
    expect(input(element).value).toBe('2026-10-10');
  });

  it('shows the placeholder while empty', () => {
    const element = mount();

    expect(input(element).getAttribute('placeholder')).toBe('请选择日期');
    expect(input(element).hasAttribute('value')).toBe(false);
  });
});

describe('an-date — panel', () => {
  it('opens from the trigger and reports the state through ARIA and events', () => {
    const element = mount({ value: DAY });
    const opened: Event[] = [];
    element.addEventListener('an-date-open', (event) => opened.push(event));

    openPanel(element);

    expect(element.isOpen).toBe(true);
    expect(element.hasAttribute('open')).toBe(true);
    expect(panel(element).hidden).toBe(false);
    expect(input(element).getAttribute('aria-expanded')).toBe('true');
    expect(opened).toHaveLength(1);
    expect(title(element)).toBe('2026年3月');
  });

  it('selects a day, closes the panel and emits one change', () => {
    const element = mount({ value: DAY });
    const changes = track(element);
    const closed: Event[] = [];
    element.addEventListener('an-date-close', (event) => closed.push(event));

    openPanel(element);
    day(element, '2026-03-10')!.click();

    expect(element.value).toBe('2026-03-10');
    expect(changes).toHaveLength(1);
    expect(changes[0].value).toBe('2026-03-10');
    expect(changes[0].originalEvent).toBeInstanceOf(Event);
    expect(panel(element).hidden).toBe(true);
    expect(element.hasAttribute('open')).toBe(false);
    expect(input(element).getAttribute('aria-expanded')).toBe('false');
    expect(closed).toHaveLength(1);
    expect(element.shadowRoot!.activeElement).toBe(input(element));
  });

  it('picks a day from the neighbouring month', () => {
    const element = mount({ value: DAY });
    openPanel(element);
    const outside = element.shadowRoot!.querySelector<HTMLButtonElement>('[part~="day-outside"]')!;
    const iso = outside.dataset.iso!;

    expect(iso < '2026-03-01' || iso > '2026-03-31').toBe(true);
    outside.click();

    expect(element.value).toBe(iso);
    expect(panel(element).hidden).toBe(true);
  });

  it('moves the month with the header arrows', () => {
    const element = mount({ value: DAY });
    openPanel(element);
    const click = (part: string): void => {
      element.shadowRoot!.querySelector<HTMLElement>(`[part~="${part}"]`)!.click();
    };

    click('nav-next');
    expect(title(element)).toBe('2026年4月');
    click('nav-prev');
    click('nav-prev');
    expect(title(element)).toBe('2026年2月');
  });

  it('disables days outside min and max', () => {
    const element = mount({ value: DAY, min: '2026-03-10', max: '2026-03-20' });
    const changes = track(element);
    openPanel(element);

    const below = day(element, '2026-03-09')!;
    const above = day(element, '2026-03-21')!;
    expect(below.disabled).toBe(true);
    expect(below.getAttribute('aria-disabled')).toBe('true');
    expect(above.disabled).toBe(true);
    expect(day(element, '2026-03-12')!.disabled).toBe(false);

    below.click();
    above.click();
    expect(element.value).toBe(DAY);
    expect(changes).toHaveLength(0);

    day(element, '2026-03-12')!.click();
    expect(element.value).toBe('2026-03-12');
  });

  it('selects today from the footer', () => {
    const element = mount({ value: DAY });
    openPanel(element);

    element.shadowRoot!.querySelector<HTMLElement>('[part~="today"]')!.click();

    expect(element.value).toBe(todayLocal());
    expect(panel(element).hidden).toBe(true);
  });

  it('clears the value from the footer and disables the button afterwards', () => {
    const element = mount({ value: DAY });
    const changes = track(element);
    openPanel(element);
    const clear = (): HTMLButtonElement =>
      element.shadowRoot!.querySelector<HTMLButtonElement>('[part~="clear"]')!;

    expect(clear().disabled).toBe(false);
    clear().click();

    expect(element.value).toBe('');
    expect(changes[0].value).toBe('');
    expect(clear().disabled).toBe(true);
  });

  it('does not open while disabled or readonly', () => {
    const disabled = mount({ value: DAY, disabled: '' });
    const readonly = mount({ value: DAY, readonly: '' });

    expect(input(disabled).disabled).toBe(true);
    expect(input(readonly).readOnly).toBe(true);
    trigger(disabled).click();
    trigger(readonly).click();

    expect(disabled.isOpen).toBe(false);
    expect(readonly.isOpen).toBe(false);
    expect(panel(disabled).hidden).toBe(true);
    expect(panel(readonly).hidden).toBe(true);
  });

  it('opens declaratively through the `open` attribute', () => {
    const element = mount({ value: DAY, open: '' });

    expect(element.isOpen).toBe(true);
    expect(panel(element).hidden).toBe(false);
    expect(input(element).getAttribute('aria-expanded')).toBe('true');
  });
});

describe('an-date — controlled open state', () => {
  it('reflects the boolean open property onto the attribute and back', () => {
    const element = mount({ value: DAY });

    expect(element.open).toBe(false);
    expect(element.isOpen).toBe(false);
    expect(element.hasAttribute('open')).toBe(false);

    element.open = true;
    expect(element.hasAttribute('open')).toBe(true);
    expect(element.isOpen).toBe(true);
    expect(panel(element).hidden).toBe(false);

    element.open = false;
    expect(element.hasAttribute('open')).toBe(false);
    expect(element.isOpen).toBe(false);
    expect(panel(element).hidden).toBe(true);

    element.setAttribute('open', '');
    expect(element.open).toBe(true);
    expect(element.isOpen).toBe(true);
  });

  it('opens, toggles and closes through the methods', () => {
    const element = mount({ value: DAY });

    element.show();
    expect(element.open).toBe(true);
    expect(panel(element).hidden).toBe(false);

    element.toggle();
    expect(element.open).toBe(false);
    expect(panel(element).hidden).toBe(true);

    element.toggle();
    expect(element.open).toBe(true);

    element.close();
    expect(element.open).toBe(false);
    expect(element.hasAttribute('open')).toBe(false);
  });

  it('forces open back to false for inline and disabled controls', () => {
    const inline = mount({ value: DAY, inline: '' });
    inline.open = true;
    expect(inline.open).toBe(false);
    expect(panel(inline).hidden).toBe(false);

    const disabled = mount({ value: DAY, disabled: '' });
    disabled.open = true;
    expect(disabled.open).toBe(false);
    expect(disabled.hasAttribute('open')).toBe(false);
    expect(panel(disabled).hidden).toBe(true);
  });
});

describe('an-date — keyboard', () => {
  it('enters the grid with ArrowDown and moves real focus with the arrows', () => {
    const element = mount({ value: DAY });
    openPanel(element);

    press(input(element), 'ArrowDown');
    expect(element.shadowRoot!.activeElement).toBe(day(element, DAY));

    press(day(element, DAY)!, 'ArrowRight');
    expect(element.shadowRoot!.activeElement).toBe(day(element, '2026-03-16'));

    press(day(element, '2026-03-16')!, 'ArrowDown');
    expect(element.shadowRoot!.activeElement).toBe(day(element, '2026-03-23'));

    press(day(element, '2026-03-23')!, 'ArrowLeft');
    expect(element.shadowRoot!.activeElement).toBe(day(element, '2026-03-22'));
  });

  it('jumps to the week edges with Home and End', () => {
    const element = mount({ value: '2026-03-18' });
    openPanel(element);
    press(input(element), 'ArrowDown');

    press(day(element, '2026-03-18')!, 'Home');
    expect((element.shadowRoot!.activeElement as HTMLElement).dataset.iso).toBe('2026-03-16');

    press(day(element, '2026-03-16')!, 'End');
    expect((element.shadowRoot!.activeElement as HTMLElement).dataset.iso).toBe('2026-03-22');
  });

  it('pages through months and selects with Enter', () => {
    const element = mount({ value: '2026-03-18' });
    const changes = track(element);
    openPanel(element);
    press(input(element), 'ArrowDown');

    press(day(element, '2026-03-18')!, 'PageDown');
    expect(title(element)).toBe('2026年4月');
    expect((element.shadowRoot!.activeElement as HTMLElement).dataset.iso).toBe('2026-04-18');

    press(day(element, '2026-04-18')!, 'PageUp');
    expect(title(element)).toBe('2026年3月');
    expect((element.shadowRoot!.activeElement as HTMLElement).dataset.iso).toBe('2026-03-18');

    press(day(element, '2026-03-18')!, 'Enter');
    expect(element.value).toBe('2026-03-18');
    expect(changes).toHaveLength(1);
    expect(panel(element).hidden).toBe(true);
  });

  it('restores the panel scroll position across a keyboard re-render', () => {
    const element = mount({ value: DAY });
    openPanel(element);
    press(input(element), 'ArrowDown');
    panel(element).scrollTop = 42;

    press(day(element, DAY)!, 'ArrowRight');

    expect(panel(element).scrollTop).toBe(42);
    expect((element.shadowRoot!.activeElement as HTMLElement).dataset.iso).toBe('2026-03-16');
  });

  it('closes with Escape and returns focus to the trigger', () => {
    const element = mount({ value: DAY });
    openPanel(element);
    press(input(element), 'ArrowDown');

    press(day(element, DAY)!, 'Escape');

    expect(element.isOpen).toBe(false);
    expect(panel(element).hidden).toBe(true);
    expect(element.shadowRoot!.activeElement).toBe(input(element));
  });
});

describe('an-date — typed input', () => {
  it('parses a typed ISO date on blur and emits a change', () => {
    const element = mount({ value: DAY });
    const changes = track(element);
    const field = input(element);

    field.value = '2026-05-06';
    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));

    expect(element.value).toBe('2026-05-06');
    expect(changes).toHaveLength(1);
    expect(changes[0].value).toBe('2026-05-06');
    // A blur commit keeps the panel closed and re-renders the formatted value.
    expect(input(element).value).toBe('2026-05-06');
  });

  it('reverts unparsable and out-of-range text', () => {
    const element = mount({ value: DAY, min: '2026-03-01', max: '2026-03-20' });
    const changes = track(element);

    const field = input(element);
    field.value = 'not-a-date';
    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    expect(element.value).toBe(DAY);
    expect(input(element).value).toBe(DAY);

    const tooEarly = input(element);
    tooEarly.value = '2026-02-01';
    tooEarly.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    expect(element.value).toBe(DAY);
    expect(input(element).value).toBe(DAY);
    expect(changes).toHaveLength(0);
  });

  it('commits with Enter and closes the panel', () => {
    const element = mount({ value: DAY });
    const changes = track(element);
    openPanel(element);
    input(element).value = '2026-04-02';

    press(input(element), 'Enter');

    expect(element.value).toBe('2026-04-02');
    expect(changes).toHaveLength(1);
    expect(panel(element).hidden).toBe(true);
  });

  it('clears the value when the field is emptied and blurred', () => {
    const element = mount({ value: DAY });
    const changes = track(element);
    const field = input(element);

    field.value = '';
    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));

    expect(element.value).toBe('');
    expect(changes[0].value).toBe('');
  });
});

describe('an-date — form integration', () => {
  it('reports valueMissing while required and empty', () => {
    document.body.innerHTML = '<form><an-date name="day" required></an-date></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-date') as AnDate;

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

    element.value = DAY;
    expect(internalsState(element)!.flags).toEqual({});
    form.requestSubmit();
    expect(submits).toHaveLength(1);
  });

  it('submits the selected day through FormData', () => {
    document.body.innerHTML = '<form><an-date name="day" value="2026-03-15"></an-date></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-date') as AnDate;

    expect(new FormData(form).get('day')).toBe(DAY);

    element.value = '2026-04-01';
    expect(new FormData(form).get('day')).toBe('2026-04-01');

    element.value = '';
    expect(new FormData(form).has('day')).toBe(false);
  });

  it('exposes its own FormData snapshot', () => {
    const element = mount({ name: 'day', value: DAY });

    expect(element.getFormData()!.get('day')).toBe(DAY);

    element.value = '';
    expect(element.getFormData()).toBeNull();
  });

  it('restores the mounted value on form reset', () => {
    document.body.innerHTML = `<form><an-date name="day" value="${DAY}"></an-date></form>`;
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-date') as AnDate;

    element.value = '2026-09-09';
    form.reset();

    expect(element.value).toBe(DAY);
    expect(input(element).value).toBe(DAY);
  });
});

describe('an-date — inline mode', () => {
  it('renders a permanent panel without a trigger', () => {
    const element = mount({ value: DAY, inline: '' });

    expect(element.shadowRoot!.querySelector('[part~="trigger"]')).toBeNull();
    expect(element.shadowRoot!.querySelector('[part~="input"]')).toBeNull();
    expect(panel(element).hidden).toBe(false);
    expect(days(element)).toHaveLength(42);
    expect(element.hasAttribute('open')).toBe(false);
  });

  it('selects a day without any popover state', () => {
    const element = mount({ inline: '', value: DAY });
    const changes = track(element);

    day(element, DAY)!.click();

    expect(element.value).toBe(DAY);
    expect(changes).toHaveLength(1);
    expect(panel(element).hidden).toBe(false);
    expect(element.shadowRoot!.querySelector('[part~="day-selected"]')).not.toBeNull();
  });

  it('moves focus into the grid and keeps it after a re-render', () => {
    const element = mount({ value: DAY, inline: '' });

    day(element, DAY)!.focus();
    press(day(element, DAY)!, 'ArrowRight');

    const focused = element.shadowRoot!.activeElement as HTMLElement;
    expect(focused.dataset.iso).toBe('2026-03-16');
    // The arrow re-rendered the grid; the replacement button is the real focus.
    expect(element.shadowRoot!.contains(focused)).toBe(true);
  });
});

describe('an-date — disabled and readonly edge cases', () => {
  it('keeps the input disabled through a form fieldset', () => {
    document.body.innerHTML =
      `<form><fieldset disabled><an-date name="day" value="${DAY}"></an-date></fieldset></form>`;
    const element = document.querySelector('an-date') as AnDate;
    const form = document.querySelector('form')!;

    // happy-dom does not walk `<fieldset disabled>`; the platform callback does.
    element.formDisabledCallback(true);
    expect(input(element).disabled).toBe(true);
    expect(internalsState(element)!.flags).toEqual({});
    expect(new FormData(form).has('day')).toBe(false);

    element.formDisabledCallback(false);
    expect(input(element).disabled).toBe(false);
    expect(new FormData(form).get('day')).toBe(DAY);
  });

  it('sizes through the size attribute without losing the trigger', () => {
    for (const size of ['sm', 'md', 'lg']) {
      const element = mount({ value: DAY, size });
      expect(element.getAttribute('size')).toBe(size);
      expect(trigger(element)).not.toBeNull();
    }
  });
});

describe('an-date — label slot', () => {
  it('reveals the label part once the label slot is filled', async () => {
    const element = mount({ value: DAY });
    const label = (): HTMLElement =>
      element.shadowRoot!.querySelector<HTMLElement>('[part~="label"]')!;

    expect(label().hasAttribute('hidden')).toBe(true);

    const span = document.createElement('span');
    span.slot = 'label';
    span.textContent = '日期';
    element.append(span);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(label().hasAttribute('hidden')).toBe(false);
    expect(label().querySelector('slot')!.getAttribute('name')).toBe('label');
  });
});

describe('an-date — date formatting helpers', () => {
  it('formats month, day and unpadded tokens', () => {
    const element = mount({ value: '2026-01-05', format: 'YYYY年M月D日' });

    expect(input(element).value).toBe('2026年1月5日');
  });

  it('keeps the raw value while the display pattern changes', () => {
    const element = mount({ value: '2026-01-05' });

    element.setAttribute('format', 'DD.MM.YYYY');
    expect(element.value).toBe('2026-01-05');
    expect(input(element).value).toBe('05.01.2026');
  });
});
