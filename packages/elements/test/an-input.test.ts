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

  it('blocks requestSubmit while required and the value is only whitespace', () => {
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

    // Blank means "nothing typed": spaces alone do not satisfy `required`.
    type(element, '   ');
    const state = internalsState(element)!;
    expect(state.flags).toMatchObject({ valueMissing: true });
    expect(state.message).toBe('此字段为必填项。');
    // The host now surfaces the platform state `<an-field>` reads.
    expect(element.validationMessage).toBe('此字段为必填项。');
    expect(element.validity?.valueMissing).toBe(true);

    form.requestSubmit();
    expect(submits).toHaveLength(0);
    expect(invalids).toHaveLength(1);

    type(element, ' filled ');
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

// ---------------------------------------------------------------------------
// Enhancement contract: maxlength / clearable / show-count / prefix / suffix.
// ---------------------------------------------------------------------------

/** The clear button, once the component paints one. */
function clearButton(element: AnInput): HTMLElement | null {
  return element.shadowRoot!.querySelector<HTMLElement>('[part~="clear"]');
}

/** The character counter. */
function counter(element: AnInput): HTMLElement | null {
  return element.shadowRoot!.querySelector<HTMLElement>('[part~="count"]');
}

/** Wraps a prefix / suffix slot, text or slotted. */
function affix(element: AnInput, name: 'prefix' | 'suffix'): HTMLElement | null {
  return element.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
}

describe('an-input — clear interaction contract', () => {
  it('emits input, change, then clear exactly once after updating form state', () => {
    const form = document.createElement('form');
    const element = document.createElement('an-input') as AnInput;
    element.name = 'nickname';
    element.clearable = true;
    element.value = 'ada';
    form.append(element);
    document.body.append(form);

    const events: Array<{ name: string; event: CustomEvent; formValue: FormDataEntryValue | null }> = [];
    for (const name of ['an-input', 'an-change', 'an-input-clear']) {
      element.addEventListener(name, (event) => {
        events.push({
          name,
          event: event as CustomEvent,
          formValue: new FormData(form).get('nickname'),
        });
      });
    }

    const activation = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
    clearButton(element)!.dispatchEvent(activation);

    expect(element.value).toBe('');
    expect(internalsState(element)!.value).toBe('');
    expect(events.map(({ name }) => name)).toEqual(['an-input', 'an-change', 'an-input-clear']);
    expect(events.map(({ formValue }) => formValue)).toEqual(['', '', '']);
    expect(events[0].event.detail).toEqual({ value: '', originalEvent: activation });
    expect(events[1].event.detail).toEqual({ value: '', originalEvent: activation });
    expect(events[2].event.detail).toEqual({ value: '' });
    expect(events.every(({ event }) => event.bubbles && event.composed)).toBe(true);
  });

  it.each(['Enter', ' '])('makes the clear button keyboard-activatable with %s', (key) => {
    const element = mount({ clearable: '', value: 'ada' });
    const clear = clearButton(element)!;
    const input = inner(element);
    const events: string[] = [];
    for (const name of ['an-input', 'an-change', 'an-input-clear']) {
      element.addEventListener(name, () => events.push(name));
    }
    clear.focus();
    expect(document.activeElement).toBe(element);
    expect(element.shadowRoot!.activeElement).toBe(clear);

    const activation = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
    clear.dispatchEvent(activation);

    expect(activation.defaultPrevented).toBe(true);
    expect(element.value).toBe('');
    expect(events).toEqual(['an-input', 'an-change', 'an-input-clear']);
    expect(element.shadowRoot!.activeElement).toBe(input);
  });

  it('does not let clear activation bubble into the wrapping label', () => {
    const element = mount({ clearable: '', label: 'Name', value: 'Ada' });
    const input = inner(element);
    const clear = clearButton(element)!;
    input.blur();

    clear.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));

    expect(element.value).toBe('');
    expect(element.shadowRoot!.activeElement).toBe(input);
  });

  it('clear events release an an-field auto-error for the owning native form', () => {
    const form = document.createElement('form');
    const field = document.createElement('an-field');
    field.label = 'Nickname';
    const element = document.createElement('an-input') as AnInput;
    element.name = 'nickname';
    element.required = true;
    element.clearable = true;
    element.value = 'Ada';
    field.append(element);
    form.append(field);
    document.body.append(form);

    element.value = '';
    form.requestSubmit();
    expect(field.shadowRoot!.querySelector('[part="error"]')!.hasAttribute('hidden')).toBe(false);

    element.value = 'Ada';
    expect(field.shadowRoot!.querySelector('[part="error"]')!.hasAttribute('hidden')).toBe(false);
    clearButton(element)!.click();

    expect(element.value).toBe('');
    expect(field.shadowRoot!.querySelector('[part="error"]')!.hasAttribute('hidden')).toBe(true);
    expect(new FormData(form).get('nickname')).toBe('');
  });
});

describe('an-input — slot assignment', () => {
  it.each(['prefix', 'suffix'] as const)('paints an empty-text element assigned to the %s slot', async (name) => {
    const element = mount();
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('slot', name);
    icon.setAttribute('aria-hidden', 'true');
    element.append(icon);
    await Promise.resolve();

    const wrapper = affix(element, name)!;
    const slot = wrapper.querySelector<HTMLSlotElement>(`slot[name="${name}"]`)!;
    expect(slot.assignedNodes({ flatten: true })).toContain(icon);
    expect(element.contains(icon)).toBe(true);
    expect(icon.hasAttribute('slot')).toBe(true);
    expect(icon.slot).toBe(name);

    icon.remove();
    await Promise.resolve();
    expect(affix(element, name)).toBeNull();
    expect(icon.hasAttribute('slot')).toBe(true);
    expect(icon.slot).toBe(name);
  });

  it('keeps non-empty text slotted and updates after it is removed', async () => {
    const element = mount();
    const icon = document.createElement('span');
    icon.slot = 'prefix';
    icon.textContent = 'magnifier';
    element.append(icon);
    await Promise.resolve();

    const slot = affix(element, 'prefix')!.querySelector<HTMLSlotElement>('slot')!;
    expect(slot.assignedNodes({ flatten: true })).toContain(icon);
    expect(icon.textContent).toBe('magnifier');
    icon.remove();
    await Promise.resolve();
    expect(affix(element, 'prefix')).toBeNull();
  });
});

describe('an-input — edge attributes', () => {
  it('treats maxlength=0 as a real native constraint and counter limit', () => {
    const element = mount({ maxlength: '0', 'show-count': '' });
    expect(inner(element).getAttribute('maxlength')).toBe('0');
    expect(counter(element)?.textContent).toBe('0/0');
  });

  it('applies spellcheck changes made after connection', () => {
    const element = mount();
    expect(inner(element).getAttribute('spellcheck')).toBeNull();
    element.setAttribute('spellcheck', 'false');
    expect(inner(element).getAttribute('spellcheck')).toBe('false');
    element.removeAttribute('spellcheck');
    expect(inner(element).getAttribute('spellcheck')).toBeNull();
  });
});
describe('an-input — maxlength forwarding', () => {
  it('forwards `maxlength` to the inner input', () => {
    const element = mount({ maxlength: '12' });

    expect(element.maxlength).toBe(12);
    expect(inner(element).getAttribute('maxlength')).toBe('12');
  });

  it('omits the attribute for the `-1` sentinel', () => {
    const element = mount();
    expect(element.maxlength).toBe(-1);
    expect(inner(element).hasAttribute('maxlength')).toBe(false);

    element.maxlength = 20;
    expect(inner(element).getAttribute('maxlength')).toBe('20');

    element.maxlength = -1;
    expect(inner(element).hasAttribute('maxlength')).toBe(false);
  });
});

describe('an-input — clearable', () => {
  it('paints no clear button unless `clearable` is set', () => {
    const element = mount({ value: 'ada' });
    expect(element.clearable).toBe(false);
    expect(clearButton(element)).toBeNull();
  });

  it('shows the clear button only while the field has a value', () => {
    const element = mount({ clearable: '' });
    expect(clearButton(element)).toBeNull();

    type(element, 'ada');
    expect(clearButton(element)).not.toBeNull();

    type(element, '');
    expect(clearButton(element)).toBeNull();
  });

  it('empties the field and emits `an-input-clear` when clicked', () => {
    const element = mount({ clearable: '' });
    const cleared: CustomEvent[] = [];
    element.addEventListener('an-input-clear', (event) => cleared.push(event as CustomEvent));
    type(element, 'ada');

    clearButton(element)!.click();

    expect(element.value).toBe('');
    expect(inner(element).value).toBe('');
    expect(cleared).toHaveLength(1);
    expect(cleared[0].detail).toEqual({ value: '' });
  });

  it('hides the clear button while disabled or readonly', () => {
    const disabled = mount({ clearable: '', disabled: '', value: 'ada' });
    expect(clearButton(disabled)).toBeNull();

    const readonly = mount({ clearable: '', readonly: '', value: 'ada' });
    expect(clearButton(readonly)).toBeNull();
  });

  it('keeps the form entry in step after a clear', () => {
    const form = document.createElement('form');
    document.body.append(form);
    const element = document.createElement('an-input') as AnInput;
    element.setAttribute('clearable', '');
    element.setAttribute('name', 'nick');
    form.append(element);
    type(element, 'ada');

    clearButton(element)!.click();

    // An empty value on a named control still reaches FormData as `''`, not
    // `null`: `#syncForm()` calls `setFormValue(this.#value)` unconditionally
    // (same as `<an-textarea>`), so the entry exists with a blank value. This
    // matches the empty-value case asserted above for the `q` field.
    expect(new FormData(form).has('nick')).toBe(true);
    expect(new FormData(form).get('nick')).toBe('');
    expect(internalsState(element).value).toBe('');
  });
});

describe('an-input — show-count', () => {
  it('paints no counter unless `show-count` is set', () => {
    const element = mount({ value: 'ada' });
    expect(element.showCount).toBe(false);
    expect(counter(element)).toBeNull();
  });

  it('shows `length/maxlength` with a limit', () => {
    const element = mount({ 'show-count': '', maxlength: '12', value: 'ada' });

    const node = counter(element);
    expect(node).not.toBeNull();
    expect(node!.textContent?.trim()).toBe('3/12');
  });

  it('shows the bare length without a limit', () => {
    const element = mount({ 'show-count': '', value: 'ada' });
    expect(counter(element)!.textContent?.trim()).toBe('3');

    type(element, 'ada l');
    expect(counter(element)!.textContent?.trim()).toBe('5');
  });
});

describe('an-input — prefix and suffix', () => {
  it('renders the `prefix` / `suffix` text in its own part', () => {
    const element = mount({ prefix: '￥', suffix: '元' });

    expect(affix(element, 'prefix')!.textContent?.trim()).toBe('￥');
    expect(affix(element, 'suffix')!.textContent?.trim()).toBe('元');
  });

  it('renders no affix wrapper when neither text nor slot is present', () => {
    const element = mount();
    expect(affix(element, 'prefix')).toBeNull();
    expect(affix(element, 'suffix')).toBeNull();
  });

  it('lets `slot="prefix"` win over the `prefix` text', async () => {
    const element = mount({ prefix: '￥' });
    const icon = document.createElement('b');
    icon.setAttribute('slot', 'prefix');
    icon.textContent = 'ICON';
    element.append(icon);
    // `slotchange` is dispatched on the next microtask.
    await Promise.resolve();

    // The slotted content replaces the text; the text must not be painted.
    const wrapper = affix(element, 'prefix')!;
    const slot = wrapper.querySelector<HTMLSlotElement>('slot[name="prefix"]')!;
    expect(wrapper.querySelector('slot')).not.toBeNull();
    expect(wrapper.textContent).not.toContain('￥');
    expect(slot.assignedNodes({ flatten: true })).toContain(icon);
  });

  it('keeps the affixes out of `value` and `FormData`', () => {
    const form = document.createElement('form');
    document.body.append(form);
    const element = document.createElement('an-input') as AnInput;
    element.setAttribute('name', 'price');
    element.setAttribute('prefix', '￥');
    element.setAttribute('suffix', '元');
    form.append(element);

    type(element, '42');

    expect(element.value).toBe('42');
    expect(new FormData(form).get('price')).toBe('42');
  });
});

describe('an-input — autocomplete forwarding', () => {
  it('forwards `autocomplete` to the inner input', () => {
    const element = mount({ autocomplete: 'email' });
    expect(inner(element).getAttribute('autocomplete')).toBe('email');

    element.autocomplete = 'off';
    expect(inner(element).getAttribute('autocomplete')).toBe('off');

    element.autocomplete = '';
    expect(inner(element).hasAttribute('autocomplete')).toBe(false);
  });
});
