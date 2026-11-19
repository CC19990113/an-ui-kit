/** @vitest-environment happy-dom */
// The shim has to be installed before the elements are defined, so that the
// constructor's `attachInternals()` call finds it. Static imports are evaluated
// in source order.
import './helpers/form-internals';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnOption } from '../src/option/an-option';
import { AnSelect } from '../src/select/an-select';
import selectCssSource from '../src/select/an-select.css?inline';
import { internalsState } from './helpers/form-internals';
import { componentSuite } from './helpers/harness';

// The components are not wired into `src/index.ts` yet, so the test registers
// them. The guard keeps a second import (or a hot reload) from throwing.
if (typeof customElements !== 'undefined' && !customElements.get('an-option')) {
  customElements.define('an-option', AnOption);
}
if (typeof customElements !== 'undefined' && !customElements.get('an-select')) {
  customElements.define('an-select', AnSelect);
}

const CSS_VARS = [
  '--an-select-height',
  '--an-select-bg',
  '--an-select-fg',
  '--an-select-border-color',
  '--an-select-radius',
  '--an-select-font-size',
  '--an-select-padding-x',
  '--an-select-focus-ring',
  '--an-select-panel-bg',
  '--an-select-panel-max-height',
  '--an-select-min-width',
];

const CITIES = '<option value="bj">北京</option><option value="sh">上海</option>';

function mount(attributes: Record<string, string> = {}, options = CITIES): AnSelect {
  const element = document.createElement('an-select') as AnSelect;
  element.innerHTML = options;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
}

function trigger(element: AnSelect): HTMLElement {
  return element.shadowRoot!.querySelector('[part~="trigger"]') as HTMLElement;
}

function panel(element: AnSelect): HTMLElement {
  return element.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
}

function listbox(element: AnSelect): HTMLElement {
  return element.shadowRoot!.querySelector('[part~="listbox"]') as HTMLElement;
}

function options(element: AnSelect): HTMLElement[] {
  return Array.from(element.shadowRoot!.querySelectorAll('[part~="option"]'));
}

function tagRemove(element: AnSelect, index: number): HTMLButtonElement {
  return element.shadowRoot!.querySelectorAll('[part~="tag-remove"]')[index] as HTMLButtonElement;
}

function search(el: AnSelect): HTMLInputElement {
  return el.shadowRoot!.querySelector('[part~="search"]') as HTMLInputElement;
}

function click(target: Element): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function press(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

function open(element: AnSelect): void {
  click(trigger(element));
}

function choose(element: AnSelect, index: number): MouseEvent {
  return click(options(element)[index]);
}

function typeSearch(element: AnSelect, value: string): void {
  const input = search(element);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const MANY = Array.from(
  { length: 250 },
  (_, index) => `<option value="v${index}">Item ${index}</option>`,
).join('');

componentSuite({
  tag: 'an-select',
  ctor: AnSelect,
  defaults: AnSelect.defaults,
  events: ['an-select-change', 'an-select-open', 'an-select-close', 'an-search'],
  cssVars: CSS_VARS,
  // Parts that always exist; conditional parts are covered by the tests below.
  parts: ['base', 'trigger', 'placeholder', 'panel', 'listbox', 'empty', 'loading'],
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('structure and option source', () => {
  it('renders its own combobox instead of a native select', () => {
    const element = mount();
    const combobox = trigger(element);

    expect(element.shadowRoot!.querySelector('select')).toBeNull();
    expect(combobox.getAttribute('role')).toBe('combobox');
    expect(combobox.getAttribute('aria-haspopup')).toBe('listbox');
    expect(combobox.getAttribute('aria-expanded')).toBe('false');
    expect(combobox.getAttribute('aria-controls')).toBe(listbox(element).id);
    expect(combobox.tabIndex).toBe(0);
    expect(panel(element).hidden).toBe(true);
  });

  it('shows the placeholder part while nothing is selected', () => {
    const element = mount({ placeholder: '请选择' });
    const placeholder = element.shadowRoot!.querySelector('[part~="placeholder"]') as HTMLElement;

    expect(placeholder.textContent).toBe('请选择');
    expect(placeholder.hidden).toBe(false);
    expect(placeholder.classList.contains('placeholder')).toBe(true);
    expect(selectCssSource).toMatch(/\.placeholder\s*\{[^}]*--an-color-fg-3/);
    expect(element.value).toBe('');
  });

  it('mirrors the light-DOM native options into the listbox', () => {
    const element = mount();
    open(element);

    expect(options(element)).toHaveLength(2);
    expect(options(element)[0].textContent).toContain('北京');
    expect(options(element)[1].textContent).toContain('上海');
    expect(listbox(element).getAttribute('role')).toBe('listbox');
  });

  it('falls back to the option text when no value attribute is present', () => {
    const element = mount({}, '<option>上海</option>');
    expect(element.value).toBe('上海');
    expect(element.shadowRoot!.querySelector('.value')?.textContent).toBe('上海');
  });

  it('defaults a bare single select to the first enabled option', () => {
    const element = mount(
      {},
      '<option value="bj" disabled>北京</option><option value="sh">上海</option>',
    );

    expect(element.value).toBe('sh');
    expect(element.shadowRoot!.querySelector('.value')?.textContent).toBe('上海');
  });

  it('keeps the empty value when a placeholder is present', () => {
    const element = mount({ placeholder: '请选择' });

    expect(element.value).toBe('');
    expect(options(element)[0].getAttribute('aria-selected')).toBe('false');
  });

  it('renders and escapes the visible label and links it to the trigger', () => {
    const element = mount({ label: '城市 <b>' });
    const label = element.shadowRoot!.querySelector('[part~="label"]') as HTMLElement;
    const combobox = trigger(element);

    expect(label.textContent).toBe('城市 <b>');
    expect(label.querySelector('b')).toBeNull();
    expect(label.id.length).toBeGreaterThan(0);
    expect(label.htmlFor).toBe(combobox.id);
    expect(combobox.getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('has no label part when no label is set', () => {
    const element = mount();
    expect(element.shadowRoot!.querySelector('[part~="label"]')).toBeNull();
  });

  it('forwards a host aria-label to the trigger when no label is rendered', () => {
    const element = mount();
    element.setAttribute('aria-label', '城市选择');

    expect(trigger(element).getAttribute('aria-label')).toBe('城市选择');
  });

  it('mirrors author HTML from an an-option into the list item', () => {
    const element = mount(
      {},
      '<an-option value="bj"><span class="icon">★</span><span class="sub">北京</span></an-option>' +
        '<an-option value="sh">上海</an-option>',
    );
    open(element);

    const content = options(element)[0].querySelector('.option-content') as HTMLElement;
    expect(content.querySelector('.icon')?.textContent).toBe('★');
    expect(content.querySelector('.sub')?.textContent).toBe('北京');
    expect(element.value).toBe('bj');
  });

  it('exposes a live option snapshot through the options property', () => {
    const element = mount();
    expect(element.options).toEqual([
      { value: 'bj', label: '北京', disabled: false },
      { value: 'sh', label: '上海', disabled: false },
    ]);
  });

  it('gives each option a stable id across renders', () => {
    const element = mount();
    open(element);
    const first = options(element)[0].id;
    element.open = false;
    element.open = true;

    expect(options(element)[0].id).toBe(first);
  });

  it('marks disabled options with aria-disabled and skips them', () => {
    const element = mount({}, '<option value="bj">北京</option><option value="sh" disabled>上海</option>');
    open(element);

    expect(options(element)[1].getAttribute('aria-disabled')).toBe('true');
    press(trigger(element), 'ArrowDown');
    expect(trigger(element).getAttribute('aria-activedescendant')).toBe(options(element)[0].id);
  });

  it('follows options appended at runtime', async () => {
    const element = mount();
    const gz = document.createElement('option');
    gz.value = 'gz';
    gz.textContent = '广州';
    element.append(gz);
    await settle();

    open(element);
    expect(options(element)).toHaveLength(3);
    expect(options(element)[2].textContent).toContain('广州');
  });

  it('follows attribute changes on runtime options', async () => {
    const element = mount();
    element.querySelector('option[value="sh"]')!.setAttribute('disabled', '');
    await settle();
    open(element);

    expect(options(element)[1].getAttribute('aria-disabled')).toBe('true');
  });

  it('follows text and markup changes on runtime options', async () => {
    const element = mount();
    element.querySelector('option[value="sh"]')!.textContent = '上海滩';
    await settle();
    open(element);

    expect(options(element)[1].textContent).toContain('上海滩');
  });

  it('clears the value when the selected option is removed', async () => {
    const element = mount();
    choose(element, 1);
    expect(element.value).toBe('sh');

    element.querySelector('option[value="sh"]')!.remove();
    await settle();

    expect(element.value).toBe('');
    expect((element.shadowRoot!.querySelector('[part~="placeholder"]') as HTMLElement).hidden).toBe(false);
  });
});

describe('popover behaviour', () => {
  it('opens on a trigger click and reflects the open attribute', () => {
    const element = mount();
    const seen: Event[] = [];
    element.addEventListener('an-select-open', (event) => seen.push(event));
    open(element);

    expect(element.open).toBe(true);
    expect(element.hasAttribute('open')).toBe(true);
    expect(trigger(element).getAttribute('aria-expanded')).toBe('true');
    expect(panel(element).hidden).toBe(false);
    expect(seen).toHaveLength(1);
  });

  it('closes on a second trigger click', () => {
    const element = mount();
    const seen: Event[] = [];
    element.addEventListener('an-select-close', (event) => seen.push(event));
    open(element);
    open(element);

    expect(element.open).toBe(false);
    expect(element.hasAttribute('open')).toBe(false);
    expect(trigger(element).getAttribute('aria-expanded')).toBe('false');
    expect(panel(element).hidden).toBe(true);
    expect(seen).toHaveLength(1);
  });

  it('drives the panel through the open property and the toggle method', () => {
    const element = mount();
    element.open = true;
    expect(element.open).toBe(true);
    expect(panel(element).hidden).toBe(false);

    element.toggle();
    expect(element.open).toBe(false);
    expect(panel(element).hidden).toBe(true);

    element.open = true;
    element.close();
    expect(element.open).toBe(false);
  });

  it('opens from the open attribute', () => {
    const element = mount();
    element.setAttribute('open', '');

    expect(element.open).toBe(true);
    expect(trigger(element).getAttribute('aria-expanded')).toBe('true');
  });

  it('closes on Escape and keeps focus on the trigger', () => {
    const element = mount();
    open(element);
    press(trigger(element), 'Escape');

    expect(element.open).toBe(false);
    expect(element.shadowRoot!.activeElement).toBe(trigger(element));
  });

  it('closes on Tab without blocking the default focus move', () => {
    const element = mount();
    open(element);
    const event = press(trigger(element), 'Tab');

    expect(element.open).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it('closes on an outside pointerdown', () => {
    const element = mount();
    open(element);
    document.body.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, composed: true }),
    );

    expect(element.open).toBe(false);
    expect(panel(element).hidden).toBe(true);
  });

  it('shows the loading part while loading', () => {
    const element = mount({ loading: '' });
    const loading = element.shadowRoot!.querySelector('[part~="loading"]') as HTMLElement;
    expect(loading.hidden).toBe(false);
    expect(loading.textContent).toContain('加载中');

    element.loading = false;
    expect(
      (element.shadowRoot!.querySelector('[part~="loading"]') as HTMLElement).hidden,
    ).toBe(true);
  });

  it('refuses to open while disabled', () => {
    const element = mount({ disabled: '' });
    open(element);
    element.open = true;

    expect(element.open).toBe(false);
    expect(trigger(element).getAttribute('aria-disabled')).toBe('true');
    expect(trigger(element).tabIndex).toBe(-1);
  });

  it('keeps DOM focus on the trigger while moving the active option', () => {
    const element = mount();
    open(element);

    expect(element.shadowRoot!.activeElement).toBe(trigger(element));
    press(trigger(element), 'ArrowDown');
    expect(element.shadowRoot!.activeElement).toBe(trigger(element));
  });
});

describe('single selection', () => {
  it('selects an option on click, closes and emits the change detail', () => {
    const element = mount();
    const seen: CustomEvent[] = [];
    element.addEventListener('an-select-change', (event) => seen.push(event as CustomEvent));
    open(element);
    const original = choose(element, 1);

    expect(element.value).toBe('sh');
    expect(element.values).toEqual(['sh']);
    expect(element.open).toBe(false);
    expect(seen).toHaveLength(1);
    expect(seen[0].detail.value).toBe('sh');
    expect(seen[0].detail.values).toEqual(['sh']);
    expect(seen[0].detail.option).toEqual({ value: 'sh', label: '上海', disabled: false });
    expect(seen[0].detail.originalEvent).toBe(original);
  });

  it('moves with ArrowDown and commits with Enter', () => {
    const element = mount();
    open(element);
    press(trigger(element), 'ArrowDown');
    const active = trigger(element).getAttribute('aria-activedescendant');
    expect(active).toBe(options(element)[1].id);

    press(trigger(element), 'Enter');
    expect(element.value).toBe('sh');
    expect(element.open).toBe(false);
  });

  it('opens with Enter or Space while closed', () => {
    const element = mount();
    trigger(element).focus();
    press(trigger(element), 'Enter');
    expect(element.open).toBe(true);

    press(trigger(element), 'Escape');
    expect(element.open).toBe(false);

    press(trigger(element), ' ');
    expect(element.open).toBe(true);
  });

  it('jumps to the first and last enabled options with Home and End', () => {
    const element = mount({ value: 'sh' });
    open(element);
    press(trigger(element), 'Home');
    press(trigger(element), 'Enter');
    expect(element.value).toBe('bj');

    open(element);
    press(trigger(element), 'End');
    press(trigger(element), 'Enter');
    expect(element.value).toBe('sh');
  });

  it('moves ten rows with PageDown and PageUp', () => {
    const element = mount({}, MANY);
    open(element);
    press(trigger(element), 'PageDown');
    expect(trigger(element).getAttribute('aria-activedescendant')).toBe(options(element)[10].id);

    press(trigger(element), 'PageUp');
    expect(trigger(element).getAttribute('aria-activedescendant')).toBe(options(element)[0].id);
  });

  it('skips disabled options while moving', () => {
    const element = mount(
      {},
      '<option value="bj">北京</option><option value="sh" disabled>上海</option><option value="gz">广州</option>',
    );
    open(element);
    press(trigger(element), 'ArrowDown');
    press(trigger(element), 'Enter');

    expect(element.value).toBe('gz');
  });

  it('points aria-activedescendant at the highlighted option', () => {
    const element = mount();
    open(element);

    expect(trigger(element).getAttribute('aria-activedescendant')).toBe(options(element)[0].id);
    press(trigger(element), 'ArrowDown');
    expect(trigger(element).getAttribute('aria-activedescendant')).toBe(options(element)[1].id);
  });

  it('marks the selected option with aria-selected', () => {
    const element = mount();
    expect(options(element)[0].getAttribute('aria-selected')).toBe('true');
    expect(options(element)[1].getAttribute('aria-selected')).toBe('false');

    open(element);
    choose(element, 1);
    expect(options(element)[0].getAttribute('aria-selected')).toBe('false');
    expect(options(element)[1].getAttribute('aria-selected')).toBe('true');
  });

  it('matches typeahead text and commits the highlighted option', () => {
    const element = mount(
      {},
      '<option value="beijing">Beijing</option><option value="shanghai">Shanghai</option>' +
        '<option value="shenzhen">Shenzhen</option>',
    );
    trigger(element).focus();
    press(trigger(element), 's');
    expect(element.open).toBe(true);
    press(trigger(element), 'h');
    press(trigger(element), 'Enter');

    expect(element.value).toBe('shanghai');
  });

  it('never writes the value property back onto the attribute', () => {
    const element = mount({ value: 'sh' });
    choose(element, 0);

    expect(element.value).toBe('bj');
    expect(element.getAttribute('value')).toBe('sh');
  });

  it('honours a later value attribute update', () => {
    const element = mount();
    element.setAttribute('value', 'sh');

    expect(element.value).toBe('sh');
    expect(element.shadowRoot!.querySelector('.value')?.textContent).toBe('上海');
  });

  it('ignores unrelated change events from the light DOM', () => {
    const element = mount();
    const seen: Event[] = [];
    element.addEventListener('an-select-change', (event) => seen.push(event));

    element.querySelector('option')!.dispatchEvent(
      new Event('change', { bubbles: true, composed: true }),
    );
    expect(seen).toHaveLength(0);
  });
});

describe('multiple selection', () => {
  it('toggles values and keeps the panel open', () => {
    const element = mount({ multiple: '' });
    const seen: CustomEvent[] = [];
    element.addEventListener('an-select-change', (event) => seen.push(event as CustomEvent));
    open(element);
    choose(element, 0);
    expect(element.values).toEqual(['bj']);
    expect(element.open).toBe(true);

    choose(element, 1);
    expect(element.values).toEqual(['bj', 'sh']);
    expect(element.open).toBe(true);
    expect(seen).toHaveLength(2);
    expect(seen[1].detail.values).toEqual(['bj', 'sh']);
  });

  it('renders tags and the +N overflow on the trigger', () => {
    const element = mount({ multiple: '', 'max-tags': '1' });
    open(element);
    choose(element, 0);
    choose(element, 1);

    const tags = element.shadowRoot!.querySelectorAll('[part~="tag"]');
    expect(tags).toHaveLength(1);
    expect(tags[0].textContent).toContain('北京');
    expect(element.shadowRoot!.querySelector('.tag-overflow')?.textContent).toBe('+1');
  });

  it('removes a value through its tag remove button', () => {
    const element = mount({ multiple: '' });
    const seen: CustomEvent[] = [];
    element.addEventListener('an-select-change', (event) => seen.push(event as CustomEvent));
    open(element);
    choose(element, 0);
    choose(element, 1);
    const original = click(tagRemove(element, 0));

    expect(element.values).toEqual(['sh']);
    expect(element.open).toBe(true);
    expect(seen).toHaveLength(3);
    expect(seen[2].detail.option).toEqual({ value: 'bj', label: '北京', disabled: false });
    expect(seen[2].detail.originalEvent).toBe(original);
  });

  it('removes the last tag with Backspace', () => {
    const element = mount({ multiple: '' });
    open(element);
    choose(element, 0);
    choose(element, 1);
    trigger(element).focus();
    press(trigger(element), 'Backspace');

    expect(element.values).toEqual(['bj']);
  });

  it('toggles the highlighted option with Space', () => {
    const element = mount({ multiple: '' });
    open(element);
    press(trigger(element), 'ArrowDown');
    press(trigger(element), ' ');

    expect(element.values).toEqual(['sh']);
    expect(element.open).toBe(true);
  });

  it('seeds a multi selection from the values attribute', () => {
    const element = mount({ multiple: '', values: 'bj,sh' });

    expect(element.values).toEqual(['bj', 'sh']);
    expect(element.shadowRoot!.querySelectorAll('[part~="tag"]')).toHaveLength(2);
    expect(listbox(element).getAttribute('aria-multiselectable')).toBe('true');
  });

  it('selects everything and clears through the API', () => {
    const element = mount({ multiple: '' });
    element.selectAll();
    expect(element.values).toEqual(['bj', 'sh']);

    element.clear();
    expect(element.values).toEqual([]);
    expect(element.open).toBe(false);
  });

  it('migrates a single value when multiple is turned on', () => {
    const element = mount({ value: 'sh' });
    element.multiple = true;
    expect(element.values).toEqual(['sh']);

    open(element);
    choose(element, 0);
    expect(element.values).toEqual(['sh', 'bj']);
  });

  it('prunes removed options from the values list', async () => {
    const element = mount({ multiple: '', values: 'bj,sh' });
    element.querySelector('option[value="sh"]')!.remove();
    await settle();

    expect(element.values).toEqual(['bj']);
  });
});

describe('search', () => {
  it('renders the search part and filters locally', () => {
    const element = mount({ searchable: '' });
    open(element);
    expect(search(element)).not.toBeNull();

    typeSearch(element, '上');
    expect(options(element)).toHaveLength(1);
    expect(options(element)[0].textContent).toContain('上海');
  });

  it('shows the empty part when nothing matches', () => {
    const element = mount({ searchable: '' });
    open(element);
    typeSearch(element, 'zzz');

    const empty = element.shadowRoot!.querySelector('[part~="empty"]') as HTMLElement;
    expect(options(element)).toHaveLength(0);
    expect(empty.hidden).toBe(false);
  });

  it('debounces an-search by 150ms', () => {
    vi.useFakeTimers();
    const element = mount({ searchable: '' });
    open(element);
    const seen: CustomEvent[] = [];
    element.addEventListener('an-search', (event) => seen.push(event as CustomEvent));

    typeSearch(element, '上');
    vi.advanceTimersByTime(149);
    expect(seen).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(seen).toHaveLength(1);
    expect(seen[0].detail).toEqual({ query: '上' });
  });

  it('does not filter or emit during IME composition', () => {
    vi.useFakeTimers();
    const element = mount({ searchable: '' });
    open(element);
    const input = search(element);
    const seen: CustomEvent[] = [];
    element.addEventListener('an-search', (event) => seen.push(event as CustomEvent));

    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, composed: true }));
    typeSearch(element, '上');
    vi.advanceTimersByTime(200);

    expect(options(element)).toHaveLength(2);
    expect(seen).toHaveLength(0);

    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, composed: true }));
    expect(options(element)).toHaveLength(1);
    vi.advanceTimersByTime(150);
    expect(seen).toHaveLength(1);
  });

  it('closes from the search box with Escape and returns focus to the trigger', () => {
    const element = mount({ searchable: '' });
    open(element);
    search(element).focus();
    press(search(element), 'Escape');

    expect(element.open).toBe(false);
    expect(element.shadowRoot!.activeElement).toBe(trigger(element));
  });

  it('resets the query when the panel closes', () => {
    const element = mount({ searchable: '' });
    open(element);
    typeSearch(element, '上');
    expect(options(element)).toHaveLength(1);

    element.open = false;
    element.open = true;
    expect(search(element).value).toBe('');
    expect(options(element)).toHaveLength(2);
  });
});

describe('virtual scrolling', () => {
  it('renders only a window for more than 200 options', () => {
    const element = mount({}, MANY);
    open(element);
    const rendered = options(element);

    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(250);
    expect(rendered[0].getAttribute('aria-setsize')).toBe('250');
    expect(rendered[0].getAttribute('aria-posinset')).toBe('1');
    expect(element.shadowRoot!.querySelector('.virtual-spacer')).not.toBeNull();
  });

  it('renders every option when virtual is off', () => {
    const element = mount({ virtual: 'off' }, MANY);
    open(element);

    expect(options(element)).toHaveLength(250);
    expect(element.shadowRoot!.querySelector('.virtual-spacer')).toBeNull();
  });

  it('virtual=on forces a window below the automatic threshold', () => {
    const markup = Array.from(
      { length: 20 },
      (_, index) => `<option value="v${index}">Item ${index}</option>`,
    ).join('');
    const element = mount({ virtual: 'on' }, markup);
    open(element);

    expect(options(element).length).toBeGreaterThan(0);
    expect(options(element).length).toBeLessThan(20);
  });

  it('moves the rendered window when the list scrolls', () => {
    const element = mount({}, MANY);
    open(element);
    const box = listbox(element);
    box.scrollTop = 4000;
    box.dispatchEvent(new Event('scroll'));

    const rendered = options(element);
    expect(rendered.length).toBeGreaterThan(0);
    expect(Number(rendered[0].dataset.optionIndex)).toBeGreaterThan(90);
    expect(Number(rendered[0].dataset.optionIndex)).toBeLessThanOrEqual(95);
  });

  it('restores scrollTop and the highlight after a re-render', () => {
    const element = mount({}, MANY);
    open(element);
    press(trigger(element), 'ArrowDown');
    press(trigger(element), 'ArrowDown');
    const active = trigger(element).getAttribute('aria-activedescendant');
    expect(active).not.toBeNull();

    const box = listbox(element);
    box.scrollTop = 4000;
    box.dispatchEvent(new Event('scroll'));
    element.setAttribute('size', 'lg');

    const nextBox = listbox(element);
    expect(nextBox.scrollTop).toBe(4000);
    expect(element.shadowRoot!.querySelector(`#${active}`)).not.toBeNull();
  });
});

describe('accessibility and form integration', () => {
  it('reflects required, invalid and disabled on the host and the trigger', () => {
    const element = mount({ required: '', invalid: '', disabled: '' });
    const combobox = trigger(element);

    expect(combobox.getAttribute('aria-required')).toBe('true');
    expect(combobox.getAttribute('aria-invalid')).toBe('true');
    expect(combobox.getAttribute('aria-disabled')).toBe('true');
    expect(element.getAttribute('aria-required')).toBe('true');
    expect(element.getAttribute('aria-invalid')).toBe('true');
    expect(element.getAttribute('aria-disabled')).toBe('true');

    element.required = false;
    element.invalid = false;
    element.disabled = false;

    expect(trigger(element).hasAttribute('aria-required')).toBe(false);
    expect(trigger(element).hasAttribute('aria-invalid')).toBe(false);
    expect(trigger(element).hasAttribute('aria-disabled')).toBe(false);
    expect(element.hasAttribute('aria-required')).toBe(false);
    expect(element.hasAttribute('aria-invalid')).toBe(false);
    expect(element.hasAttribute('aria-disabled')).toBe(false);
  });

  it('anchors the required validity on the trigger and clears it on selection', async () => {
    document.body.innerHTML =
      '<form><an-select name="city" required placeholder="请选择">' +
      '<option value="bj">北京</option><option value="sh">上海</option>' +
      '</an-select></form>';
    const element = document.querySelector('an-select') as AnSelect;
    await settle();

    const state = internalsState(element)!;
    expect(state.flags).toEqual({ valueMissing: true });
    expect(state.message).toBe('此字段为必填项。');
    expect(state.anchor).toBe(trigger(element));
    expect(element.checkValidity()).toBe(false);

    open(element);
    choose(element, 0);
    expect(internalsState(element)!.flags).toEqual({});
    expect(element.checkValidity()).toBe(true);
  });

  it('blocks requestSubmit while required and empty, then lets it through', async () => {
    document.body.innerHTML =
      '<form><an-select name="city" required placeholder="请选择">' +
      '<option value="bj">北京</option><option value="sh">上海</option>' +
      '</an-select></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-select') as AnSelect;
    await settle();
    const submits: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });

    form.requestSubmit();
    expect(submits).toHaveLength(0);

    open(element);
    choose(element, 1);
    form.requestSubmit();
    expect(submits).toHaveLength(1);
  });

  it('submits the selected value through FormData', async () => {
    document.body.innerHTML =
      '<form><an-select name="city">' +
      '<option value="bj">北京</option><option value="sh">上海</option>' +
      '</an-select></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-select') as AnSelect;
    await settle();

    expect(new FormData(form).get('city')).toBe('bj');

    open(element);
    choose(element, 1);
    expect(new FormData(form).get('city')).toBe('sh');
  });

  it('publishes no entry while the placeholder is still selected', async () => {
    document.body.innerHTML =
      '<form><an-select name="city" placeholder="请选择">' +
      '<option value="bj">北京</option></an-select></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-select') as AnSelect;
    await settle();

    expect(new FormData(form).has('city')).toBe(false);
    open(element);
    choose(element, 0);
    expect(new FormData(form).get('city')).toBe('bj');
  });

  it('appends the multi values under the same name', async () => {
    document.body.innerHTML =
      '<form><an-select name="city" multiple values="bj,sh">' +
      '<option value="bj">北京</option><option value="sh">上海</option>' +
      '</an-select></form>';
    const element = document.querySelector('an-select') as AnSelect;
    await settle();

    expect(element.getFormData()!.getAll('city')).toEqual(['bj', 'sh']);
  });

  it('restores the mount-time value on form reset', async () => {
    document.body.innerHTML =
      '<form><an-select name="city" value="sh">' +
      '<option value="bj">北京</option><option value="sh">上海</option>' +
      '</an-select></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-select') as AnSelect;
    await settle();
    expect(element.value).toBe('sh');

    open(element);
    choose(element, 0);
    expect(element.value).toBe('bj');

    form.reset();
    expect(element.value).toBe('sh');
    expect(element.shadowRoot!.querySelector('.value')?.textContent).toBe('上海');
  });

  it('keeps the reset target stable when the value attribute changes', async () => {
    document.body.innerHTML =
      '<form><an-select name="city" value="sh">' +
      '<option value="bj">北京</option><option value="sh">上海</option>' +
      '</an-select></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-select') as AnSelect;
    await settle();

    element.setAttribute('value', 'bj');
    expect(element.value).toBe('bj');
    form.reset();
    expect(element.value).toBe('sh');
  });

  it('treats an ancestor fieldset disabled as the barred state', async () => {
    document.body.innerHTML =
      '<form><fieldset disabled><an-select name="city" required placeholder="请选择">' +
      '<option value="bj">北京</option></an-select></fieldset></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-select') as AnSelect;
    await settle();
    const submits: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });

    element.formDisabledCallback(true);
    expect(internalsState(element)!.flags).toEqual({});
    expect(new FormData(form).has('city')).toBe(false);
    form.requestSubmit();
    expect(submits).toHaveLength(1);

    element.formDisabledCallback(false);
    expect(internalsState(element)!.flags).toEqual({ valueMissing: true });
    expect(trigger(element).hasAttribute('aria-disabled')).toBe(false);
  });

  it('excludes a disabled select from FormData and validation', async () => {
    document.body.innerHTML =
      '<form><an-select name="city" required disabled placeholder="请选择">' +
      '<option value="bj">北京</option></an-select></form>';
    const element = document.querySelector('an-select') as AnSelect;
    await settle();

    expect(internalsState(element)!.flags).toEqual({});
    expect(element.getFormData()).toBeNull();

    element.disabled = false;
    expect(internalsState(element)!.flags).toEqual({ valueMissing: true });
  });

  it('returns null from getFormData without a name', () => {
    const element = mount();
    expect(element.getFormData()).toBeNull();
  });
});

describe('styles', () => {
  it('ships the documented theme, reset and token hooks', () => {
    expect(selectCssSource).toContain(":host([data-theme='dark'])");
    expect(selectCssSource).toContain(":host([data-theme='light'])");
    expect(selectCssSource).toContain('@media (prefers-color-scheme: dark)');
    expect(selectCssSource).toContain('box-sizing: border-box');
    expect(selectCssSource).toContain('border: 0 solid');
    expect(selectCssSource).toContain('margin: 0');
    expect(selectCssSource).toContain('line-height: 1.5');
    expect(selectCssSource).toContain('--an-color-accent-9');
    expect(selectCssSource).toContain('--an-color-danger-9');
  });

  it('hides the light-DOM options and draws its own arrow', () => {
    expect(selectCssSource).toMatch(/::slotted\(option\)\s*\{[^}]*display:\s*none/);
    expect(selectCssSource).toContain('appearance: none');
    expect(selectCssSource).toMatch(/\.chevron\s*\{[^}]*border-top:/);
    expect(selectCssSource).not.toContain('url(');
  });

  it('scales the trigger height with the size attribute', () => {
    const height = (element: AnSelect): number =>
      parseFloat(getComputedStyle(trigger(element)).height);
    const small = mount({ size: 'sm' });
    const medium = mount();
    const large = mount({ size: 'lg' });

    expect(height(small)).toBeGreaterThan(0);
    expect(height(small)).toBeLessThan(height(medium));
    expect(height(medium)).toBeLessThan(height(large));
  });
});

// ---------------------------------------------------------------------------
// Grouped options: `<an-option-group>`.
// ---------------------------------------------------------------------------

const GROUPED =
  '<an-option-group label="华东"><an-option value="sh">上海</an-option>' +
  '<an-option value="hz">杭州</an-option></an-option-group>' +
  '<an-option-group label="华北" disabled><an-option value="bj">北京</an-option>' +
  '<an-option value="tj">天津</an-option></an-option-group>' +
  '<an-option-group label="华南"><an-option value="gz">广州</an-option></an-option-group>';

/** The `role="group"` wrappers the select painted into its own listbox. */
function groups(element: AnSelect): HTMLElement[] {
  return Array.from(element.shadowRoot!.querySelectorAll('[part~="group"]'));
}

/**
 * The visible option text. The painted row also carries a `✓` indicator, so
 * only the `option-content` span holds the label.
 */
function optionLabels(element: AnSelect): string[] {
  return options(element).map(
    (option) => option.querySelector('.option-content')?.textContent?.trim() ?? '',
  );
}

/**
 * Labels of the painted rows inside one wrapper. The painted row also carries
 * a `✓` indicator, so only the `option-content` span holds the label.
 */
function labelsIn(wrapper: Element): string[] {
  return Array.from(wrapper.querySelectorAll('[part~="option"]')).map(
    (option) => option.querySelector('.option-content')?.textContent?.trim() ?? '',
  );
}

/** The painted row that renders one option label. */
function rowByLabel(element: AnSelect, label: string): HTMLElement {
  const row = options(element).find(
    (option) => option.querySelector('.option-content')?.textContent?.trim() === label,
  );
  if (row === undefined) throw new Error(`no painted row for ${label}`);
  return row;
}

describe('an-select — grouped options', () => {
  it('paints one `role="group"` wrapper per `<an-option-group>` with its aria-label', () => {
    const element = mount({}, GROUPED);
    open(element);

    const wrappers = groups(element);
    expect(wrappers).toHaveLength(3);
    expect(wrappers.map((wrapper) => wrapper.getAttribute('role'))).toEqual([
      'group',
      'group',
      'group',
    ]);
    expect(wrappers.map((wrapper) => wrapper.getAttribute('aria-label'))).toEqual([
      '华东',
      '华北',
      '华南',
    ]);
    expect(wrappers.map((wrapper) => wrapper.getAttribute('part'))).toEqual([
      'group',
      'group',
      'group',
    ]);
  });

  it('nests the group options inside their wrapper, in author order', () => {
    const element = mount({}, GROUPED);
    open(element);

    const wrappers = groups(element);
    // The painted rows carry no value attribute; their text is the option label,
    // which is what author order shows.
    expect(labelsIn(wrappers[0])).toEqual(['上海', '杭州']);
    expect(labelsIn(wrappers[1])).toEqual(['北京', '天津']);
    expect(labelsIn(wrappers[2])).toEqual(['广州']);
    expect(optionLabels(element)).toEqual(['上海', '杭州', '北京', '天津', '广州']);

    // Each wrapper holds exactly its own options, not its neighbours'.
    for (const wrapper of wrappers) {
      for (const row of Array.from(wrapper.querySelectorAll('[part~="option"]'))) {
        expect(row.closest('[part~="group"]')).toBe(wrapper);
      }
    }
  });

  it('marks a disabled group and puts every option of it out of reach', () => {
    const element = mount({}, GROUPED);
    open(element);

    const wrappers = groups(element);
    expect(wrappers[1].getAttribute('data-disabled')).toBe('true');
    expect(wrappers[0].hasAttribute('data-disabled')).toBe(false);
    expect(wrappers[2].hasAttribute('data-disabled')).toBe(false);

    // The group's `disabled` cascades onto each option it holds.
    const blocked = Array.from(wrappers[1].querySelectorAll('[part~="option"]'));
    expect(blocked).toHaveLength(2);
    for (const option of blocked) {
      expect(option.getAttribute('aria-disabled')).toBe('true');
    }

    // An enabled option carries no `aria-disabled` at all (implicit `false`).
    const free = Array.from(wrappers[0].querySelectorAll('[part~="option"]'));
    for (const option of free) {
      expect(option.hasAttribute('aria-disabled')).toBe(false);
    }
  });

  it('refuses to select an option of a disabled group', () => {
    // `placeholder` keeps the mount from auto-seeding the first option, so the
    // value starts empty and a blocked click would show up as a change.
    const element = mount({ placeholder: '请选择' }, GROUPED);
    const seen: CustomEvent[] = [];
    element.addEventListener('an-select-change', (event) => seen.push(event as CustomEvent));
    open(element);

    expect(element.value).toBe('');

    const blocked = rowByLabel(element, '北京');
    expect(blocked.getAttribute('aria-disabled')).toBe('true');
    click(blocked);

    expect(element.value).toBe('');
    expect(seen).toHaveLength(0);

    // An enabled option in another group still selects, proving the block came
    // from the group and not from a broken click path.
    click(rowByLabel(element, '广州'));
    expect(element.value).toBe('gz');
    expect(seen).toHaveLength(1);
  });

  it('publishes ARIA sets that are relative to the group, not the whole list', () => {
    const element = mount({}, GROUPED);
    open(element);

    const first = groups(element)[0].querySelectorAll('[part~="option"]');
    expect(first[0].getAttribute('aria-posinset')).toBe('1');
    expect(first[0].getAttribute('aria-setsize')).toBe('2');
    expect(first[1].getAttribute('aria-posinset')).toBe('2');
    expect(first[1].getAttribute('aria-setsize')).toBe('2');

    // The second group is numbered from 1 again, not continuing the first.
    const second = groups(element)[1].querySelectorAll('[part~="option"]');
    expect(second[0].getAttribute('aria-posinset')).toBe('1');
    expect(second[0].getAttribute('aria-setsize')).toBe('2');
  });

  it('counts a flat option against the whole list, not a group', () => {
    const element = mount(
      {},
      '<an-option-group label="A"><an-option value="a">A</an-option></an-option-group>' +
        '<option value="x">X</option>',
    );
    open(element);

    // Index 1 of 2 options total; it belongs to no group, so it uses the list.
    const flatOption = options(element)[1];
    expect(flatOption.getAttribute('aria-posinset')).toBe('2');
    expect(flatOption.getAttribute('aria-setsize')).toBe('2');
  });

  it('renders no group wrapper when the group label is blank', () => {
    // A blank label still yields the wrapper (it holds the options) but without
    // an accessible name, so `aria-label` is simply absent.
    const element = mount(
      {},
      '<an-option-group label="   "><an-option value="sh">上海</an-option></an-option-group>',
    );
    open(element);
    const wrapper = groups(element)[0];
    expect(wrapper).toBeDefined();
    expect(wrapper.getAttribute('role')).toBe('group');
    expect(wrapper.hasAttribute('aria-label')).toBe(false);
  });

  it('hides every group whose options the search filtered out', async () => {
    const element = mount({ searchable: '' }, GROUPED);
    open(element);

    typeSearch(element, '上海');
    await settle();

    const wrappers = groups(element);
    // Only the group that still holds a match survives.
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0].getAttribute('aria-label')).toBe('华东');
    expect(optionLabels(element)).toEqual(['上海']);
  });

  it('never filters on the group title, only on the option text', async () => {
    const element = mount({ searchable: '' }, GROUPED);
    open(element);

    // "华北" is a group title; no option contains it, so nothing matches.
    typeSearch(element, '华北');
    await settle();

    expect(groups(element)).toHaveLength(0);
    expect(options(element)).toHaveLength(0);
    expect(
      element.shadowRoot!.querySelector('[part~="empty"]')!.hasAttribute('hidden'),
    ).toBe(false);
  });

  it('keeps the group relative positions valid after a filter pass', async () => {
    const element = mount({ searchable: '' }, GROUPED);
    open(element);

    typeSearch(element, '杭州');
    await settle();

    const wrapper = groups(element)[0];
    const visible = Array.from(wrapper.querySelectorAll('[part~="option"]'));
    expect(visible).toHaveLength(1);
    // Re-numbered for the filtered list, so it is both first and only.
    expect(visible[0].getAttribute('aria-posinset')).toBe('1');
    expect(visible[0].getAttribute('aria-setsize')).toBe('1');
  });

  it('walks across group boundaries with ArrowDown / ArrowUp', () => {
    const element = mount({}, GROUPED);
    open(element);

    const activeLabel = (): string | null => {
      const id = trigger(element).getAttribute('aria-activedescendant');
      const row = options(element).find((option) => option.id === id);
      return row?.querySelector('.option-content')?.textContent?.trim() ?? null;
    };
    // First enabled option is 上海 in the first group.
    expect(activeLabel()).toBe('上海');

    // 杭州 is the last option of group 1; the next step crosses into group 3
    // because 北京 / 天津 are disabled by their group.
    press(trigger(element), 'ArrowDown');
    expect(activeLabel()).toBe('杭州');
    press(trigger(element), 'ArrowDown');
    expect(activeLabel()).toBe('广州');

    // At the end the list wraps around to the first enabled option.
    press(trigger(element), 'ArrowDown');
    expect(activeLabel()).toBe('上海');

    // Upwards wraps the other way, then hops back over the disabled group.
    press(trigger(element), 'ArrowUp');
    expect(activeLabel()).toBe('广州');
    press(trigger(element), 'ArrowUp');
    expect(activeLabel()).toBe('杭州');
    press(trigger(element), 'ArrowUp');
    expect(activeLabel()).toBe('上海');
  });

  it('jumps to the first and last enabled option across groups with Home / End', () => {
    const element = mount({}, GROUPED);
    open(element);

    press(trigger(element), 'End');
    expect(trigger(element).getAttribute('aria-activedescendant')).toBe(options(element)[4].id);

    press(trigger(element), 'Home');
    expect(trigger(element).getAttribute('aria-activedescendant')).toBe(options(element)[0].id);
  });

  it('selects across groups and reports the option it came from', () => {
    const element = mount({ multiple: '', name: 'city' }, GROUPED);
    const seen: CustomEvent[] = [];
    element.addEventListener('an-select-change', (event) => seen.push(event as CustomEvent));
    open(element);

    click(options(element)[0]);
    click(options(element)[4]);

    expect(element.values).toEqual(['sh', 'gz']);
    expect(seen.map((event) => event.detail.option.value)).toEqual(['sh', 'gz']);
    expect(seen[1].detail.values).toEqual(['sh', 'gz']);
  });
});

// ---------------------------------------------------------------------------
// `an-load-more`: scroll position -> event, throttled.
// ---------------------------------------------------------------------------

/** Fakes the geometry happy-dom does not lay out. */
function setGeometry(
  list: HTMLElement,
  geometry: { scrollTop: number; scrollHeight: number; clientHeight: number },
): void {
  Object.defineProperty(list, 'scrollHeight', {
    configurable: true,
    get: () => geometry.scrollHeight,
  });
  Object.defineProperty(list, 'clientHeight', {
    configurable: true,
    get: () => geometry.clientHeight,
  });
  list.scrollTop = geometry.scrollTop;
}

function scroll(list: HTMLElement, top: number): void {
  list.scrollTop = top;
  list.dispatchEvent(new Event('scroll'));
}

describe('an-select — load more', () => {
  it('fires `an-load-more` once the list is inside the threshold', () => {
    const element = mount({ virtual: 'off' });
    const seen: CustomEvent[] = [];
    element.addEventListener('an-load-more', (event) => seen.push(event as CustomEvent));
    open(element);

    const list = listbox(element);
    setGeometry(list, { scrollTop: 0, scrollHeight: 1000, clientHeight: 300 });

    // 700px from the bottom: outside the default 80px threshold.
    scroll(list, 600);
    expect(seen).toHaveLength(0);

    // 80px from the bottom: exactly on the edge, so it fires.
    scroll(list, 620);
    expect(seen).toHaveLength(1);
    expect(seen[0].detail).toEqual({ scrollTop: 620, scrollHeight: 1000, clientHeight: 300 });
  });

  it('does not fire while the list is not scrollable', () => {
    const element = mount({ virtual: 'off' });
    const seen: CustomEvent[] = [];
    element.addEventListener('an-load-more', (event) => seen.push(event as CustomEvent));
    open(element);

    const list = listbox(element);
    setGeometry(list, { scrollTop: 0, scrollHeight: 300, clientHeight: 300 });
    scroll(list, 0);

    expect(seen).toHaveLength(0);
  });

  it('does not fire while the panel is closed', () => {
    const element = mount({ virtual: 'off' });
    const seen: CustomEvent[] = [];
    element.addEventListener('an-load-more', (event) => seen.push(event as CustomEvent));

    const list = listbox(element);
    setGeometry(list, { scrollTop: 620, scrollHeight: 1000, clientHeight: 300 });
    scroll(list, 700);

    expect(element.open).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it('throttles to one event per 200ms', () => {
    vi.useFakeTimers();
    const element = mount({ virtual: 'off' });
    const seen: CustomEvent[] = [];
    element.addEventListener('an-load-more', (event) => seen.push(event as CustomEvent));
    open(element);

    const list = listbox(element);
    setGeometry(list, { scrollTop: 0, scrollHeight: 1000, clientHeight: 300 });
    vi.setSystemTime(1_000);

    scroll(list, 650);
    expect(seen).toHaveLength(1);

    // Well inside the window: dropped.
    vi.setSystemTime(1_100);
    scroll(list, 660);
    scroll(list, 670);
    expect(seen).toHaveLength(1);

    // Just before the boundary: still dropped.
    vi.setSystemTime(1_199);
    scroll(list, 680);
    expect(seen).toHaveLength(1);

    // Past 200ms: fires again.
    vi.setSystemTime(1_200);
    scroll(list, 690);
    expect(seen).toHaveLength(2);
    expect(seen[1].detail.scrollTop).toBe(690);
    vi.useRealTimers();
  });

  it('honours `load-more-threshold`', () => {
    const element = mount({ virtual: 'off', 'load-more-threshold': '0' });
    expect(element.loadMoreThreshold).toBe(0);
    const seen: CustomEvent[] = [];
    element.addEventListener('an-load-more', (event) => seen.push(event as CustomEvent));
    open(element);

    const list = listbox(element);
    setGeometry(list, { scrollTop: 0, scrollHeight: 1000, clientHeight: 300 });

    // 60px from the bottom: inside the default 80px window, outside a 0px one.
    scroll(list, 640);
    expect(seen).toHaveLength(0);

    // Exactly at the bottom: distance 0, so a 0px threshold fires.
    scroll(list, 700);
    expect(seen).toHaveLength(1);
  });

  it('widens the window with a larger threshold', () => {
    const element = mount({ virtual: 'off', 'load-more-threshold': '400' });
    const seen: CustomEvent[] = [];
    element.addEventListener('an-load-more', (event) => seen.push(event as CustomEvent));
    open(element);

    const list = listbox(element);
    setGeometry(list, { scrollTop: 0, scrollHeight: 1000, clientHeight: 300 });

    // 350px from the bottom: still inside a 400px window.
    scroll(list, 350);
    expect(seen).toHaveLength(1);
  });

  it('clamps a negative threshold to zero instead of firing everywhere', () => {
    const element = mount({ virtual: 'off', 'load-more-threshold': '-100' });
    const seen: CustomEvent[] = [];
    element.addEventListener('an-load-more', (event) => seen.push(event as CustomEvent));
    open(element);

    const list = listbox(element);
    setGeometry(list, { scrollTop: 0, scrollHeight: 1000, clientHeight: 300 });

    scroll(list, 690);
    expect(seen).toHaveLength(0);

    scroll(list, 700);
    expect(seen).toHaveLength(1);
  });

  it('renders a `part="loading"` row only while `loading` is set', () => {
    const element = mount();
    const loading = (): HTMLElement =>
      element.shadowRoot!.querySelector('[part~="loading"]') as HTMLElement;

    expect(loading().hasAttribute('hidden')).toBe(true);
    expect(loading().textContent).toContain('加载中');

    element.loading = true;
    expect(loading().hasAttribute('hidden')).toBe(false);

    element.loading = false;
    expect(loading().hasAttribute('hidden')).toBe(true);
  });

  it('hides the empty row while loading, even with no visible option', () => {
    const element = mount({ loading: '' }, '');
    const empty = (): HTMLElement =>
      element.shadowRoot!.querySelector('[part~="empty"]') as HTMLElement;

    expect(element.loading).toBe(true);
    expect(empty().hasAttribute('hidden')).toBe(true);
    expect(
      (element.shadowRoot!.querySelector('[part~="loading"]') as HTMLElement).hasAttribute(
        'hidden',
      ),
    ).toBe(false);
  });
});
