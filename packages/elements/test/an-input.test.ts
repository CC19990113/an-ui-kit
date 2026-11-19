/** @vitest-environment happy-dom */
// The shim has to be installed before `../src/index` registers the element, so
// that the constructor's `attachInternals()` call finds it. Static imports are
// evaluated in source order.
import './helpers/form-internals';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '../src/index';
import { AnInput } from '../src/input/an-input';
import inputCssSource from '../src/input/an-input.css?inline';
import { componentSuite } from './helpers/harness';
import { internalsState } from './helpers/form-internals';

const CSS_VARS = [
  '--an-input-height',
  '--an-input-bg',
  '--an-input-fg',
  '--an-input-border-color',
  '--an-input-radius',
  '--an-input-font-size',
  '--an-input-padding-x',
  '--an-input-focus-ring',
];

function mount(attributes: Record<string, string> = {}): AnInput {
  const element = document.createElement('an-input') as AnInput;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
}

function inner(element: AnInput): HTMLInputElement {
  return element.shadowRoot!.querySelector('input')!;
}

/** Dispatches a native event that would travel through the shadow boundary. */
function fire(input: HTMLInputElement, type: 'input' | 'change'): Event {
  const event = new Event(type, { bubbles: true, composed: true });
  input.dispatchEvent(event);
  return event;
}

/** Types into the input the way a user would, then reports the native event. */
function type(element: AnInput, value: string): Event {
  const input = inner(element);
  input.value = value;
  return fire(input, 'input');
}

componentSuite({
  tag: 'an-input',
  ctor: AnInput,
  defaults: AnInput.defaults,
  events: ['an-input', 'an-change'],
  cssVars: CSS_VARS,
  parts: ['base', 'input'],
});

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('an-input', () => {
  it('renders a native input inside the base part, with no label by default', () => {
    const element = mount();
    const base = element.shadowRoot!.querySelector('[part="base"]')!;
    const input = inner(element);

    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('part')).toBe('input');
    expect(base.contains(input)).toBe(true);
    expect(input.type).toBe('text');
    expect(element.shadowRoot!.querySelector('[part="label"]')).toBeNull();
  });

  it('renders a visible <label> that wraps and names the inner input', () => {
    const element = mount({ label: 'Email' });
    const label = element.shadowRoot!.querySelector('[part="label"]')!;

    expect(label.tagName).toBe('LABEL');
    expect(label.contains(inner(element))).toBe(true);
    expect(label.control).toBe(inner(element));
    expect(label.textContent?.trim()).toBe('Email');

    element.label = 'Display name';
    expect(element.shadowRoot!.querySelector('[part="label"]')?.textContent?.trim()).toBe('Display name');
    element.label = '';
    expect(element.shadowRoot!.querySelector('[part="label"]')).toBeNull();
  });

  it('escapes the label and placeholder instead of interpreting markup', () => {
    const element = mount({ label: '<b>Name</b>', placeholder: 'a"b' });
    const label = element.shadowRoot!.querySelector('[part="label"]')!;

    expect(label.textContent?.trim()).toBe('<b>Name</b>');
    expect(label.querySelector('b')).toBeNull();
    expect(inner(element).getAttribute('placeholder')).toBe('a"b');
  });

  it('seeds value from the attribute and never writes it back', () => {
    const element = mount({ value: 'seed' });
    expect(element.value).toBe('seed');
    expect(inner(element).value).toBe('seed');

    type(element, 'typed');
    expect(element.value).toBe('typed');
    expect(element.getAttribute('value')).toBe('seed');

    element.value = 'property';
    expect(inner(element).value).toBe('property');
    expect(element.getAttribute('value')).toBe('seed');

    const bare = mount();
    bare.value = 'only-property';
    expect(bare.hasAttribute('value')).toBe(false);
    expect(inner(bare).value).toBe('only-property');
  });

  it('keeps the caret when the value property is assigned while focused', () => {
    const element = mount({ value: 'abc' });
    const input = inner(element);
    input.focus();
    input.setSelectionRange(1, 1);

    element.value = 'abcdef';
    expect(input.value).toBe('abcdef');
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(1);
  });

  it('forwards a valid type and falls back to text for anything else', () => {
    const element = mount();
    const types = ['text', 'email', 'password', 'search', 'tel', 'url', 'number'] as const;
    for (const value of types) {
      element.type = value;
      expect(inner(element).type, value).toBe(value);
    }

    element.setAttribute('type', 'bogus');
    expect(inner(element).type).toBe('text');

    element.type = 'bogus' as unknown as AnInput['type'];
    expect(inner(element).type).toBe('text');
  });

  it('renders the size scale through the real cascade', () => {
    const height = (element: AnInput): number =>
      parseFloat(getComputedStyle(inner(element)).height);

    const small = mount({ size: 'sm' });
    const medium = mount();
    const large = mount({ size: 'lg' });

    expect(height(small)).toBeGreaterThan(0);
    expect(height(small)).toBeLessThan(height(medium));
    expect(height(medium)).toBeLessThan(height(large));
  });

  it('re-emits native input and change as an-input / an-change', () => {
    const element = mount();
    const input = inner(element);
    const inputs: CustomEvent[] = [];
    const changes: CustomEvent[] = [];
    const onInput = (event: Event): void => {
      inputs.push(event as CustomEvent);
    };
    const onChange = (event: Event): void => {
      changes.push(event as CustomEvent);
    };
    document.addEventListener('an-input', onInput);
    document.addEventListener('an-change', onChange);
    try {
      input.value = 'hello';
      const inputEvent = fire(input, 'input');
      expect(inputs).toHaveLength(1);
      expect(inputs[0].bubbles).toBe(true);
      expect(inputs[0].composed).toBe(true);
      expect(inputs[0].detail).toEqual({ value: 'hello', originalEvent: inputEvent });

      const changeEvent = fire(input, 'change');
      expect(changes).toHaveLength(1);
      expect(changes[0].bubbles).toBe(true);
      expect(changes[0].composed).toBe(true);
      expect(changes[0].detail).toEqual({ value: 'hello', originalEvent: changeEvent });
    } finally {
      document.removeEventListener('an-input', onInput);
      document.removeEventListener('an-change', onChange);
    }
    expect(element.value).toBe('hello');
  });

  it('blocks input and change while disabled or readonly', () => {
    const events: Event[] = [];
    const listener = (event: Event): void => {
      events.push(event);
    };
    document.addEventListener('an-input', listener);
    document.addEventListener('an-change', listener);
    try {
      const disabled = mount({ disabled: '' });
      expect(inner(disabled).disabled).toBe(true);
      expect(inner(disabled).getAttribute('aria-disabled')).toBe('true');
      type(disabled, 'x');
      fire(inner(disabled), 'change');
      expect(disabled.value).toBe('');

      const readonly = mount({ readonly: '' });
      expect(inner(readonly).readOnly).toBe(true);
      type(readonly, 'y');
      fire(inner(readonly), 'change');
      expect(readonly.value).toBe('');
    } finally {
      document.removeEventListener('an-input', listener);
      document.removeEventListener('an-change', listener);
    }
    expect(events).toHaveLength(0);
  });

  it('names the inner input through the visible label or forwarded host ARIA', () => {
    const labelled = mount({ label: 'Email' });
    expect(labelled.shadowRoot!.querySelector('[part="label"]')!.getAttribute('part')).toBe('label');

    const ariaLabel = mount({ 'aria-label': 'Search' });
    expect(inner(ariaLabel).getAttribute('aria-label')).toBe('Search');
    ariaLabel.setAttribute('aria-label', 'Find');
    expect(inner(ariaLabel).getAttribute('aria-label')).toBe('Find');

    const ariaLabelledby = mount({ 'aria-labelledby': 'title-1' });
    expect(inner(ariaLabelledby).getAttribute('aria-labelledby')).toBe('title-1');

    const both = mount({ label: 'Name', 'aria-label': 'Other' });
    expect(inner(both).hasAttribute('aria-label')).toBe(false);
  });

  it('mirrors disabled, readonly, required and invalid to the input and internals', () => {
    const element = mount({ disabled: '', readonly: '', required: '', invalid: '' });
    const input = inner(element);

    expect(input.disabled).toBe(true);
    expect(input.readOnly).toBe(true);
    expect(input.required).toBe(true);
    expect(input.getAttribute('aria-disabled')).toBe('true');
    expect(input.getAttribute('aria-readonly')).toBe('true');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(element.getAttribute('aria-disabled')).toBe('true');
    expect(element.getAttribute('aria-readonly')).toBe('true');
    expect(element.getAttribute('aria-required')).toBe('true');
    expect(element.getAttribute('aria-invalid')).toBe('true');

    element.invalid = false;
    expect(inner(element).hasAttribute('aria-invalid')).toBe(false);
    expect(element.hasAttribute('aria-invalid')).toBe(false);
  });

  it('registers the value with the owning form so FormData carries it', () => {
    document.body.innerHTML =
      '<form><an-input name="email" value="seed@example.com"></an-input></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-input') as AnInput;

    expect(new FormData(form).get('email')).toBe('seed@example.com');

    type(element, 'next@example.com');
    expect(new FormData(form).get('email')).toBe('next@example.com');
  });

  it('blocks requestSubmit while required and empty, then lets it through', () => {
    document.body.innerHTML = '<form><an-input name="q" required></an-input></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-input') as AnInput;
    const submits: Event[] = [];
    const invalids: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });
    element.addEventListener('invalid', (event) => {
      invalids.push(event);
    });

    form.requestSubmit();
    expect(submits).toHaveLength(0);
    expect(invalids).toHaveLength(1);

    const state = internalsState(element)!;
    expect(state.flags).toMatchObject({ valueMissing: true });
    expect(state.message).toBe('此字段为必填项。');
    expect(state.anchor).toBe(inner(element));

    type(element, 'filled');
    expect(internalsState(element)!.flags).toEqual({});
    form.requestSubmit();
    expect(submits).toHaveLength(1);
  });

  it('leaves a disabled control out of FormData, like a native disabled input', () => {
    document.body.innerHTML =
      '<form><an-input name="email" value="seed@example.com"></an-input></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-input') as AnInput;

    expect(new FormData(form).get('email')).toBe('seed@example.com');

    element.disabled = true;
    expect(new FormData(form).has('email')).toBe(false);

    // Re-enabling restores the normal entry, not just an empty one.
    element.disabled = false;
    expect(new FormData(form).get('email')).toBe('seed@example.com');
  });

  it('does not block requestSubmit while disabled, even when required and empty', () => {
    document.body.innerHTML = '<form><an-input name="q" required disabled></an-input></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-input') as AnInput;
    const submits: Event[] = [];
    const invalids: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });
    element.addEventListener('invalid', (event) => {
      invalids.push(event);
    });

    // Barred from constraint validation: no `valueMissing` flag, no `invalid`.
    expect(internalsState(element)!.flags).toEqual({});
    expect(internalsState(element)!.message).toBe('');
    form.requestSubmit();
    expect(invalids).toHaveLength(0);
    expect(submits).toHaveLength(1);
    expect(new FormData(form).has('q')).toBe(false);
  });

  it('submits a read-only required field and keeps its value in FormData', () => {
    document.body.innerHTML =
      '<form><an-input name="q" value="seed" required readonly></an-input></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-input') as AnInput;
    const submits: Event[] = [];
    const invalids: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });
    element.addEventListener('invalid', (event) => {
      invalids.push(event);
    });

    // Read-only is *barred from constraint validation* like `<input readonly>`,
    // yet it is not excluded from `FormData`: the value still submits.
    expect(internalsState(element)!.flags).toEqual({});
    expect(internalsState(element)!.message).toBe('');
    expect(new FormData(form).get('q')).toBe('seed');
    form.requestSubmit();
    expect(invalids).toHaveLength(0);
    expect(submits).toHaveLength(1);
  });

  it('lets an empty read-only required field submit without a valueMissing flag', () => {
    document.body.innerHTML = '<form><an-input name="q" required readonly></an-input></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-input') as AnInput;
    const submits: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });

    expect(internalsState(element)!.flags).toEqual({});
    expect(new FormData(form).has('q')).toBe(true);
    expect(new FormData(form).get('q')).toBe('');
    form.requestSubmit();
    expect(submits).toHaveLength(1);
  });

  it('restores the required constraint when read-only is turned off', () => {
    document.body.innerHTML = '<form><an-input name="q" required readonly></an-input></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-input') as AnInput;
    const submits: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });

    form.requestSubmit();
    expect(submits).toHaveLength(1);

    // Back under constraint validation: the empty required field blocks again.
    element.readonly = false;
    expect(internalsState(element)!.flags).toEqual({ valueMissing: true });
    form.requestSubmit();
    expect(submits).toHaveLength(1);

    // ...and read-only is barred once more.
    element.readonly = true;
    expect(internalsState(element)!.flags).toEqual({});
    form.requestSubmit();
    expect(submits).toHaveLength(2);
  });

  it('treats an ancestor <fieldset disabled> as the same barred state', () => {
    document.body.innerHTML =
      '<form><fieldset disabled><an-input name="q" required></an-input></fieldset></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-input') as AnInput;
    const submits: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });

    // The platform reports the ancestor `<fieldset disabled>` this way.
    element.formDisabledCallback(true);
    expect(internalsState(element)!.flags).toEqual({});
    expect(new FormData(form).has('q')).toBe(false);
    form.requestSubmit();
    expect(submits).toHaveLength(1);

    // Re-enabling the fieldset brings the constraint back.
    element.formDisabledCallback(false);
    expect(internalsState(element)!.flags).toMatchObject({ valueMissing: true });
    expect(internalsState(element)!.message).toBe('此字段为必填项。');
    form.requestSubmit();
    expect(submits).toHaveLength(1);
  });

  it('restores the mount-time value on form reset', () => {
    document.body.innerHTML = '<form><an-input name="q" value="seed"></an-input></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-input') as AnInput;

    element.value = 'typed';
    expect(inner(element).value).toBe('typed');

    form.reset();
    expect(element.value).toBe('seed');
    expect(inner(element).value).toBe('seed');

    // Later attribute updates are honoured, but the reset target is the value
    // captured when the element was mounted.
    element.setAttribute('value', 'later');
    expect(element.value).toBe('later');
    form.reset();
    expect(element.value).toBe('seed');
  });

  it('clears validity on reset when the initial value satisfies required', () => {
    document.body.innerHTML = '<form><an-input name="q" value="seed" required></an-input></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-input') as AnInput;

    element.value = '';
    expect(internalsState(element)!.flags).toMatchObject({ valueMissing: true });
    form.reset();
    expect(element.value).toBe('seed');
    expect(internalsState(element)!.flags).toEqual({});
  });

  it('mirrors a platform disable (fieldset) into the inner input', () => {
    const element = mount({ label: 'Name' });

    element.formDisabledCallback(true);
    expect(inner(element).disabled).toBe(true);
    expect(inner(element).getAttribute('aria-disabled')).toBe('true');
    expect(element.getAttribute('aria-disabled')).toBe('true');

    element.formDisabledCallback(false);
    expect(inner(element).disabled).toBe(false);
    expect(inner(element).hasAttribute('aria-disabled')).toBe(false);
    expect(element.hasAttribute('aria-disabled')).toBe(false);
  });

  it('keeps a host-level disabled in place when the fieldset is re-enabled', () => {
    const element = mount({ disabled: '' });
    element.formDisabledCallback(true);
    element.formDisabledCallback(false);
    expect(inner(element).disabled).toBe(true);
  });

  it('keeps the colour, hook and theme contract in an-input.css', () => {
    for (const hook of CSS_VARS) expect(inputCssSource, hook).toContain(`var(${hook}`);
    expect(inputCssSource).toContain('--an-color-bg-1');
    expect(inputCssSource).toContain('--an-color-fg-1');
    expect(inputCssSource).toContain('--an-color-border-1');
    expect(inputCssSource).toContain('--an-color-accent-9');
    expect(inputCssSource).toContain('--an-color-danger-9');
    expect(inputCssSource).toContain('--an-space-3');
    expect(inputCssSource).toContain('--an-radius-md');
    expect(inputCssSource).toContain('--an-font-size-sm');
    expect(inputCssSource).toContain('color-scheme: light dark');
    expect(inputCssSource).toContain(":host([data-theme='dark'])");
    expect(inputCssSource).toContain(":host([data-theme='light'])");
  });

  it('does not write value back while re-rendering other attributes', () => {
    const element = mount({ value: 'keep' });
    const input = inner(element);
    input.focus();

    element.setAttribute('size', 'lg');
    expect(element.value).toBe('keep');
    expect(inner(element).value).toBe('keep');
    expect(element.shadowRoot!.querySelectorAll('input')).toHaveLength(1);
  });
});
