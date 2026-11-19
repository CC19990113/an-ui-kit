/** @vitest-environment happy-dom */
// The shim must be installed before the component constructors run, so that a
// form-associated element finds `attachInternals()`. Static imports run in
// source order.
import './helpers/form-internals';
import { afterEach, describe, expect, it } from 'vitest';

import { AnRadio } from '../src/radio/an-radio';
import radioCssSource from '../src/radio/an-radio.css?inline';
import { componentSuite } from './helpers/harness';

if (!customElements.get('an-radio')) {
  customElements.define('an-radio', AnRadio);
}

/** CSS custom properties `<an-radio>` documents. */
const CSS_VARS = ['--an-radio-size', '--an-radio-accent', '--an-radio-border-color'];

/** The inner native radio, the one the platform actually operates. */
function inner(element: AnRadio): HTMLInputElement {
  const input = element.shadowRoot?.querySelector('input');
  if (!input) throw new Error('an-radio did not render its inner input');
  return input;
}

function mount(
  attributes: Record<string, string> = {},
  text = '选项',
): AnRadio {
  const element = document.createElement('an-radio') as AnRadio;
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.textContent = text;
  document.body.append(element);
  return element;
}

/** Resolves after the platform's microtask-level reactions have run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  document.body.innerHTML = '';
});

componentSuite({
  tag: 'an-radio',
  ctor: AnRadio,
  defaults: { value: '', checked: false, disabled: false },
  events: ['an-radio-select'],
  cssVars: CSS_VARS,
  parts: ['base', 'control', 'label'],
});

describe('an-radio — rendering', () => {
  it('renders a native radio input inside the shadow root', () => {
    const element = mount({ value: 'pro' });

    const input = inner(element);
    expect(input.type).toBe('radio');
    expect(input.value).toBe('pro');
    expect(input.getAttribute('part')).toBeNull();
    expect(element.shadowRoot!.querySelector('[part~="control"]')).not.toBeNull();
    expect(element.shadowRoot!.querySelector('[part~="label"]')!.textContent).toContain('');
  });

  it('renders the checked state into the input and aria-checked', () => {
    const element = mount({ value: 'pro', checked: '' });
    const input = inner(element);

    expect(input.checked).toBe(true);
    expect(input.getAttribute('aria-checked')).toBe('true');
    expect(element.hasAttribute('checked')).toBe(true);
  });

  it('forwards the disabled state to the inner input', () => {
    const element = mount({ disabled: '' });
    const input = inner(element);

    expect(input.disabled).toBe(true);
    expect(input.getAttribute('aria-disabled')).toBe('true');
  });

  it('escapes a value that contains markup characters', () => {
    const element = mount({ value: 'a"b<c>&d' });
    const input = inner(element);

    expect(input.value).toBe('a"b<c>&d');
    expect(element.shadowRoot!.querySelector('b, c, script')).toBeNull();
  });

  it('renders slotted text as text, never as shadow markup', () => {
    const element = mount({ value: 'x' }, '<img src=x onerror="window.pwned = 1">');

    expect(element.shadowRoot!.querySelector('img')).toBeNull();
    expect(element.textContent).toBe('<img src=x onerror="window.pwned = 1">');
    expect(element.shadowRoot!.querySelector('slot')).not.toBeNull();
  });

  it('declares its stylesheet as a static style source', () => {
    expect(AnRadio.styles).toBe(radioCssSource);
  });
});

describe('an-radio — interaction', () => {
  it('checks itself and emits an-radio-select on a host click', () => {
    const element = mount({ value: 'pro' });
    const seen: CustomEvent[] = [];
    element.addEventListener('an-radio-select', (event) => {
      seen.push(event as CustomEvent);
    });

    element.click();

    expect(element.checked).toBe(true);
    expect(element.hasAttribute('checked')).toBe(true);
    expect(inner(element).checked).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].detail.value).toBe('pro');
    expect(seen[0].detail.originalEvent).toBeInstanceOf(Event);
  });

  it('emits a bubbling, composed event that reaches the document', () => {
    const element = mount({ value: 'pro' });
    const seen: CustomEvent[] = [];
    const listener = (event: Event): void => {
      seen.push(event as CustomEvent);
    };
    document.addEventListener('an-radio-select', listener);
    try {
      element.click();
    } finally {
      document.removeEventListener('an-radio-select', listener);
    }

    expect(seen).toHaveLength(1);
    expect(seen[0].bubbles).toBe(true);
    expect(seen[0].composed).toBe(true);
  });

  it('selects through the native change event (keyboard activation)', () => {
    const element = mount({ value: 'pro' });
    const seen: CustomEvent[] = [];
    element.addEventListener('an-radio-select', (event) => {
      seen.push(event as CustomEvent);
    });

    const input = inner(element);
    input.focus();
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(element.checked).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].detail.value).toBe('pro');
  });

  it('ignores a click while disabled', () => {
    const element = mount({ value: 'pro', disabled: '' });
    const seen: CustomEvent[] = [];
    element.addEventListener('an-radio-select', (event) => {
      seen.push(event as CustomEvent);
    });

    element.click();

    expect(element.checked).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it('ignores a second click once already checked', () => {
    const element = mount({ value: 'pro' });
    let count = 0;
    element.addEventListener('an-radio-select', () => {
      count += 1;
    });

    element.click();
    element.click();

    expect(count).toBe(1);
  });

  it('moves focus onto the native input when focus() is called', () => {
    const element = mount({ value: 'pro' });

    element.focus();

    expect(element.shadowRoot!.activeElement).toBe(inner(element));
  });

  it('keeps focus across a re-render that replaces the input', () => {
    const element = mount({ value: 'pro' });
    element.focus();
    const before = inner(element);

    element.checked = true;

    const after = inner(element);
    expect(after).not.toBe(before);
    expect(element.shadowRoot!.activeElement).toBe(after);
  });
});

describe('an-radio — roving tab stop', () => {
  it('is tabbable by default and respects the group-driven property', () => {
    const element = mount({ value: 'pro' });

    expect(element.tabbable).toBe(true);
    expect(inner(element).getAttribute('tabindex')).toBe('0');

    element.tabbable = false;
    expect(inner(element).getAttribute('tabindex')).toBe('-1');
    expect(element.hasAttribute('tabbable')).toBe(false);

    element.tabbable = true;
    expect(inner(element).getAttribute('tabindex')).toBe('0');
  });
});

describe('an-radio — async registration', () => {
  it('does not create a second input across updates', async () => {
    const element = mount({ value: 'pro' });
    element.setAttribute('disabled', '');
    await flush();

    expect(element.shadowRoot!.querySelectorAll('input')).toHaveLength(1);
  });
});
