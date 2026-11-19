/** @vitest-environment happy-dom */
// The shim has to be installed before the element is defined, so that the
// constructor's `attachInternals()` call finds it. Static imports are evaluated
// in source order.
import './helpers/form-internals';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AnSelect } from '../src/select/an-select';
import selectCssSource from '../src/select/an-select.css?inline';
import { componentSuite } from './helpers/harness';
import { internalsState } from './helpers/form-internals';

// The component is not exported from `src/index.ts` yet, so this suite registers
// it itself; the guard keeps the file safe if that registration lands later.
if (!customElements.get('an-select')) customElements.define('an-select', AnSelect);

const CSS_VARS = [
  '--an-select-height',
  '--an-select-bg',
  '--an-select-fg',
  '--an-select-border-color',
  '--an-select-radius',
  '--an-select-font-size',
  '--an-select-padding-x',
  '--an-select-focus-ring',
];

const CITIES = '<option value="bj">北京</option><option value="sh">上海</option>';

/** Mounts the element with light-DOM options, exactly like hand-written markup. */
function mount(attributes: Record<string, string> = {}, options = CITIES): AnSelect {
  const element = document.createElement('an-select') as AnSelect;
  element.innerHTML = options;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
}

function inner(element: AnSelect): HTMLSelectElement {
  return element.shadowRoot!.querySelector('select')!;
}

function innerOptions(element: AnSelect): HTMLOptionElement[] {
  return Array.from(inner(element).options);
}

function innerValues(element: AnSelect): string[] {
  return innerOptions(element).map((option) => option.value);
}

function innerTexts(element: AnSelect): string[] {
  return innerOptions(element).map((option) => option.textContent ?? '');
}

/** The light-DOM MutationObserver delivers on a later task. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Simulates a user pick: moves the inner select, then fires the native change. */
function choose(element: AnSelect, value: string): Event {
  const select = inner(element);
  select.value = value;
  const event = new Event('change', { bubbles: true, composed: true });
  select.dispatchEvent(event);
  return event;
}

componentSuite({
  tag: 'an-select',
  ctor: AnSelect,
  defaults: AnSelect.defaults,
  events: ['an-select-change'],
  cssVars: CSS_VARS,
  parts: ['base', 'select', 'chevron'],
});

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('an-select', () => {
  it('renders a native select inside the base part, with no label by default', () => {
    const element = mount();
    const base = element.shadowRoot!.querySelector('[part="base"]')!;
    const select = inner(element);
    const chevron = element.shadowRoot!.querySelector('[part="chevron"]')!;

    expect(select.tagName).toBe('SELECT');
    expect(select.getAttribute('part')).toBe('select');
    expect(base.contains(select)).toBe(true);
    expect(chevron.getAttribute('aria-hidden')).toBe('true');
    expect(element.shadowRoot!.querySelector('[part="label"]')).toBeNull();
  });

  it('mirrors the light-DOM options into the shadow select', () => {
    const element = mount();

    expect(innerValues(element)).toEqual(['bj', 'sh']);
    expect(innerTexts(element)).toEqual(['北京', '上海']);
    // The light DOM keeps its options: it is the source of truth.
    expect(element.querySelectorAll('option')).toHaveLength(2);
    expect(element.shadowRoot!.querySelectorAll('select option')).toHaveLength(2);
  });

  it('falls back to the option text when the value attribute is missing', () => {
    const element = mount({}, '<option>上海</option>');

    expect(innerValues(element)).toEqual(['上海']);
    expect(element.value).toBe('上海');
  });

  it('mirrors options added, reconfigured and removed at runtime', async () => {
    const element = mount();

    const gz = document.createElement('option');
    gz.value = 'gz';
    gz.textContent = '广州';
    element.append(gz);
    await settle();
    expect(innerValues(element)).toEqual(['bj', 'sh', 'gz']);

    element.querySelector('option[value="sh"]')!.setAttribute('disabled', '');
    await settle();
    expect(innerOptions(element)[1].disabled).toBe(true);

    element.querySelector('option[value="sh"]')!.textContent = '上海滩';
    await settle();
    expect(innerTexts(element)[1]).toBe('上海滩');

    element.querySelector('option[value="bj"]')!.remove();
    await settle();
    expect(innerValues(element)).toEqual(['sh', 'gz']);
    // The removed option was the selection, so the value falls back to empty.
    expect(element.value).toBe('');
  });

  it('prepends a disabled placeholder option when placeholder is set', () => {
    const element = mount({ placeholder: '请选择' });
    const placeholder = innerOptions(element)[0];

    expect(innerOptions(element)).toHaveLength(3);
    expect(placeholder.value).toBe('');
    expect(placeholder.textContent).toBe('请选择');
    expect(placeholder.disabled).toBe(true);
    expect(placeholder.selected).toBe(true);
    expect(inner(element).value).toBe('');
    expect(element.value).toBe('');

    // A seeded value wins over the placeholder.
    const seeded = mount({ placeholder: '请选择', value: 'sh' });
    expect(innerOptions(seeded)[0].value).toBe('');
    expect(inner(seeded).value).toBe('sh');
    expect(innerOptions(seeded)[0].selected).toBe(false);
  });

  it('seeds the selection from the value attribute and never writes it back', () => {
    const element = mount({ value: 'sh' });
    expect(element.value).toBe('sh');
    expect(inner(element).value).toBe('sh');

    choose(element, 'bj');
    expect(element.value).toBe('bj');
    expect(inner(element).value).toBe('bj');
    expect(element.getAttribute('value')).toBe('sh');

    element.value = 'sh';
    expect(inner(element).value).toBe('sh');
    expect(element.getAttribute('value')).toBe('sh');

    const bare = mount();
    // With no explicit value the platform's default (the first option) wins.
    expect(bare.value).toBe('bj');
    bare.value = 'sh';
    expect(bare.hasAttribute('value')).toBe(false);
    expect(inner(bare).value).toBe('sh');
  });

  it('dispatches an-select-change with the value and the original event', () => {
    const element = mount();
    const seen: CustomEvent[] = [];
    const listener = (event: Event): void => {
      seen.push(event as CustomEvent);
    };
    document.addEventListener('an-select-change', listener);
    try {
      const original = choose(element, 'sh');
      expect(seen).toHaveLength(1);
      expect(seen[0].bubbles).toBe(true);
      expect(seen[0].composed).toBe(true);
      expect(seen[0].detail).toEqual({ value: 'sh', originalEvent: original });
    } finally {
      document.removeEventListener('an-select-change', listener);
    }
  });

  it('ignores change events that did not come from the inner select', () => {
    const element = mount();
    const seen: Event[] = [];
    const listener = (event: Event): void => {
      seen.push(event);
    };
    document.addEventListener('an-select-change', listener);
    try {
      element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    } finally {
      document.removeEventListener('an-select-change', listener);
    }
    expect(seen).toHaveLength(0);
  });

  it('maps required, invalid and disabled onto the inner select', () => {
    const element = mount({ required: '', invalid: '' });
    const select = inner(element);

    expect(select.required).toBe(true);
    expect(select.getAttribute('aria-required')).toBe('true');
    expect(element.getAttribute('aria-required')).toBe('true');
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(element.getAttribute('aria-invalid')).toBe('true');

    element.disabled = true;
    expect(inner(element).disabled).toBe(true);
    expect(inner(element).getAttribute('aria-disabled')).toBe('true');
    expect(element.getAttribute('aria-disabled')).toBe('true');
  });

  it('clears the documented attributes again', () => {
    const element = mount({ required: '', invalid: '', disabled: '' });

    element.required = false;
    element.invalid = false;
    element.disabled = false;

    expect(inner(element).required).toBe(false);
    expect(inner(element).hasAttribute('aria-required')).toBe(false);
    expect(inner(element).hasAttribute('aria-invalid')).toBe(false);
    expect(inner(element).disabled).toBe(false);
    expect(element.hasAttribute('aria-required')).toBe(false);
    expect(element.hasAttribute('aria-invalid')).toBe(false);
    expect(element.hasAttribute('aria-disabled')).toBe(false);
  });

  it('blocks requestSubmit while required and empty, then lets it through', async () => {
    document.body.innerHTML =
      '<form><an-select name="city" required placeholder="请选择">' +
      '<option value="bj">北京</option><option value="sh">上海</option>' +
      '</an-select></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-select') as AnSelect;
    const submits: Event[] = [];
    const invalids: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });
    element.addEventListener('invalid', (event) => {
      invalids.push(event);
    });
    await settle();

    expect(internalsState(element)!.flags).toMatchObject({ valueMissing: true });
    expect(internalsState(element)!.message).toBe('此字段为必填项。');
    expect(internalsState(element)!.anchor).toBe(inner(element));

    form.requestSubmit();
    expect(invalids).toHaveLength(1);
    expect(submits).toHaveLength(0);

    choose(element, 'bj');
    expect(internalsState(element)!.flags).toEqual({});
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

    choose(element, 'sh');
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
    choose(element, 'bj');
    expect(new FormData(form).get('city')).toBe('bj');
  });

  it('restores the mount-time value on form reset', async () => {
    document.body.innerHTML =
      '<form><an-select name="city" value="sh">' +
      '<option value="bj">北京</option><option value="sh">上海</option>' +
      '</an-select></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-select') as AnSelect;
    await settle();

    choose(element, 'bj');
    expect(element.value).toBe('bj');

    form.reset();
    expect(element.value).toBe('sh');
    expect(inner(element).value).toBe('sh');

    // Later attribute updates are honoured, but the reset target stays the
    // value captured when the element was mounted.
    element.setAttribute('value', 'bj');
    expect(element.value).toBe('bj');
    form.reset();
    expect(element.value).toBe('sh');
    expect(inner(element).value).toBe('sh');
  });

  it('treats an ancestor <fieldset disabled> as the same barred state', () => {
    document.body.innerHTML =
      '<form><fieldset disabled><an-select name="city" required placeholder="请选择">' +
      '<option value="bj">北京</option></an-select></fieldset></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-select') as AnSelect;
    const submits: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });

    // The platform reports the ancestor `<fieldset disabled>` this way.
    element.formDisabledCallback(true);
    expect(inner(element).disabled).toBe(true);
    expect(internalsState(element)!.flags).toEqual({});
    expect(new FormData(form).has('city')).toBe(false);
    form.requestSubmit();
    expect(submits).toHaveLength(1);

    // Re-enabling the fieldset brings the constraint back.
    element.formDisabledCallback(false);
    expect(inner(element).disabled).toBe(false);
    expect(internalsState(element)!.flags).toMatchObject({ valueMissing: true });
    form.requestSubmit();
    expect(submits).toHaveLength(1);
  });

  it('renders a visible label that names the inner select and escapes it', () => {
    const element = mount({ label: '<b>城市</b>' });
    const label = element.shadowRoot!.querySelector('[part="label"]')!;

    expect(label.tagName).toBe('LABEL');
    expect(label.control).toBe(inner(element));
    expect(label.querySelector('b')).toBeNull();
    // The wrapped select contributes option text, so assert on the label text node.
    expect(label.querySelector('.label-text')!.textContent).toBe('<b>城市</b>');

    element.label = '收货城市';
    expect(
      element.shadowRoot!.querySelector('[part="label"] .label-text')?.textContent,
    ).toBe('收货城市');

    element.label = '';
    expect(element.shadowRoot!.querySelector('[part="label"]')).toBeNull();
  });

  it('forwards host ARIA names while no visible label exists', () => {
    const element = mount({ 'aria-label': '<b>城市</b>' });
    expect(inner(element).getAttribute('aria-label')).toBe('<b>城市</b>');

    element.setAttribute('aria-label', 'City');
    expect(inner(element).getAttribute('aria-label')).toBe('City');

    const labelledby = mount({ 'aria-labelledby': 'title-1' });
    expect(inner(labelledby).getAttribute('aria-labelledby')).toBe('title-1');

    // A visible label wins, so the forwarded name is dropped.
    const both = mount({ label: '城市', 'aria-label': 'City' });
    expect(both.shadowRoot!.querySelector('.label-text')!.textContent).toBe('城市');
    expect(inner(both).hasAttribute('aria-label')).toBe(false);
  });

  it('renders the size scale through the real cascade', () => {
    const height = (element: AnSelect): number =>
      parseFloat(getComputedStyle(inner(element)).height);

    const small = mount({ size: 'sm' });
    const medium = mount();
    const large = mount({ size: 'lg' });

    expect(height(small)).toBeGreaterThan(0);
    expect(height(small)).toBeLessThan(height(medium));
    expect(height(medium)).toBeLessThan(height(large));
  });

  it('hides the light-DOM options instead of painting them twice', () => {
    const element = mount();

    expect(selectCssSource).toContain('::slotted(option)');
    expect(selectCssSource).toMatch(/::slotted\(option\)\s*\{\s*display:\s*none/);
    // The options stay in the light DOM, which is what the sync reads.
    expect(element.querySelectorAll(':scope > option')).toHaveLength(2);
  });

  it('draws its own arrow and colours itself from tokens', () => {
    expect(selectCssSource).toContain('appearance: none');
    // A border triangle, not an image asset.
    expect(selectCssSource).toMatch(/\.chevron\s*\{[^}]*border-top:/);
    expect(selectCssSource).not.toMatch(/url\(/);

    expect(selectCssSource).toContain('--an-color-border-1');
    expect(selectCssSource).toContain('--an-color-accent-9');
    expect(selectCssSource).toContain('--an-color-danger-9');
    expect(selectCssSource).toContain('--an-color-bg-1');
    expect(selectCssSource).toContain('--an-color-fg-1');
    expect(selectCssSource).toContain('--an-space-3');
    expect(selectCssSource).toContain('--an-radius-md');
    expect(selectCssSource).toContain('--an-font-size-sm');
    expect(selectCssSource).toContain('color-scheme: light dark');
    expect(selectCssSource).toContain(":host([data-theme='dark'])");
    expect(selectCssSource).toContain(":host([data-theme='light'])");
  });

  it('does not write value back while re-rendering other attributes', () => {
    const element = mount({ value: 'sh' });
    choose(element, 'bj');

    element.setAttribute('size', 'lg');
    expect(element.value).toBe('bj');
    expect(inner(element).value).toBe('bj');
    expect(element.shadowRoot!.querySelectorAll('select')).toHaveLength(1);
  });
});
