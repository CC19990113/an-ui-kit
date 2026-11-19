/** @vitest-environment happy-dom */
// The shim has to be installed before the element's constructor calls
// `attachInternals()`, so that call finds it. Static imports are evaluated in
// source order.
import './helpers/form-internals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnTextarea } from '../src/textarea/an-textarea';
import textareaCssSource from '../src/textarea/an-textarea.css?inline';
import { componentSuite } from './helpers/harness';
import { internalsState } from './helpers/form-internals';

// `<an-textarea>` is not part of the package entry yet: this test registers it
// itself, with the same idempotent guard the entry uses.
if (!customElements.get('an-textarea')) customElements.define('an-textarea', AnTextarea);

const CSS_VARS = [
  '--an-textarea-min-height',
  '--an-textarea-bg',
  '--an-textarea-fg',
  '--an-textarea-border-color',
  '--an-textarea-radius',
  '--an-textarea-font-size',
  '--an-textarea-padding',
  '--an-textarea-focus-ring',
];

function mount(attributes: Record<string, string> = {}): AnTextarea {
  const element = document.createElement('an-textarea') as AnTextarea;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
}

function inner(element: AnTextarea): HTMLTextAreaElement {
  return element.shadowRoot!.querySelector('textarea')!;
}

/** Dispatches a native event that would travel through the shadow boundary. */
function fire(textarea: HTMLTextAreaElement, type: 'input' | 'change'): Event {
  const event = new Event(type, { bubbles: true, composed: true });
  textarea.dispatchEvent(event);
  return event;
}

/** Types into the control the way a user would, then reports the native event. */
function type(element: AnTextarea, value: string): Event {
  const textarea = inner(element);
  textarea.value = value;
  return fire(textarea, 'input');
}

componentSuite({
  tag: 'an-textarea',
  ctor: AnTextarea,
  defaults: AnTextarea.defaults,
  events: ['an-textarea-input', 'an-textarea-change'],
  cssVars: CSS_VARS,
  parts: ['base', 'textarea'],
});

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('an-textarea', () => {
  it('renders a native textarea inside the base part, with no label by default', () => {
    const element = mount();
    const base = element.shadowRoot!.querySelector('[part="base"]')!;
    const textarea = inner(element);

    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.getAttribute('part')).toBe('textarea');
    expect(base.contains(textarea)).toBe(true);
    expect(element.shadowRoot!.querySelector('[part="label"]')).toBeNull();
  });

  it('renders a visible <label> that wraps and names the inner textarea', () => {
    const element = mount({ label: 'Bio' });
    const label = element.shadowRoot!.querySelector('[part="label"]')!;

    expect(label.tagName).toBe('LABEL');
    expect(label.contains(inner(element))).toBe(true);
    expect(label.control).toBe(inner(element));
    expect(label.textContent?.trim()).toBe('Bio');

    element.label = 'About you';
    expect(element.shadowRoot!.querySelector('[part="label"]')?.textContent?.trim()).toBe('About you');
    element.label = '';
    expect(element.shadowRoot!.querySelector('[part="label"]')).toBeNull();
  });

  it('escapes the label and placeholder instead of interpreting markup', () => {
    const element = mount({ label: '<b>Bio</b>', placeholder: 'a"b' });
    const label = element.shadowRoot!.querySelector('[part="label"]')!;

    expect(label.textContent?.trim()).toBe('<b>Bio</b>');
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

  it('keeps the attribute and property in step for later value updates', () => {
    const element = mount();
    element.setAttribute('value', 'later');
    expect(element.value).toBe('later');
    expect(inner(element).value).toBe('later');
  });

  it('keeps the caret when the value property is assigned while focused', () => {
    const element = mount({ value: 'abc' });
    const textarea = inner(element);
    textarea.focus();
    textarea.setSelectionRange(1, 1);

    element.value = 'abcdef';
    expect(textarea.value).toBe('abcdef');
    expect(textarea.selectionStart).toBe(1);
    expect(textarea.selectionEnd).toBe(1);
  });

  it('re-emits native input and change as an-textarea-input / an-textarea-change', () => {
    const element = mount();
    const textarea = inner(element);
    const inputs: CustomEvent[] = [];
    const changes: CustomEvent[] = [];
    const onInput = (event: Event): void => {
      inputs.push(event as CustomEvent);
    };
    const onChange = (event: Event): void => {
      changes.push(event as CustomEvent);
    };
    document.addEventListener('an-textarea-input', onInput);
    document.addEventListener('an-textarea-change', onChange);
    try {
      textarea.value = 'hello';
      const inputEvent = fire(textarea, 'input');
      expect(inputs).toHaveLength(1);
      expect(inputs[0].bubbles).toBe(true);
      expect(inputs[0].composed).toBe(true);
      expect(inputs[0].detail).toEqual({ value: 'hello', originalEvent: inputEvent });

      const changeEvent = fire(textarea, 'change');
      expect(changes).toHaveLength(1);
      expect(changes[0].bubbles).toBe(true);
      expect(changes[0].composed).toBe(true);
      expect(changes[0].detail).toEqual({ value: 'hello', originalEvent: changeEvent });
    } finally {
      document.removeEventListener('an-textarea-input', onInput);
      document.removeEventListener('an-textarea-change', onChange);
    }
    expect(element.value).toBe('hello');
  });

  it('blocks input and change while disabled or readonly', () => {
    const events: Event[] = [];
    const listener = (event: Event): void => {
      events.push(event);
    };
    document.addEventListener('an-textarea-input', listener);
    document.addEventListener('an-textarea-change', listener);
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
      document.removeEventListener('an-textarea-input', listener);
      document.removeEventListener('an-textarea-change', listener);
    }
    expect(events).toHaveLength(0);
  });

  it('names the inner textarea through the visible label or forwarded host ARIA', () => {
    const labelled = mount({ label: 'Bio' });
    expect(labelled.shadowRoot!.querySelector('[part="label"]')!.getAttribute('part')).toBe('label');

    const ariaLabel = mount({ 'aria-label': 'Notes' });
    expect(inner(ariaLabel).getAttribute('aria-label')).toBe('Notes');
    ariaLabel.setAttribute('aria-label', 'More notes');
    expect(inner(ariaLabel).getAttribute('aria-label')).toBe('More notes');

    const ariaLabelledby = mount({ 'aria-labelledby': 'title-1' });
    expect(inner(ariaLabelledby).getAttribute('aria-labelledby')).toBe('title-1');

    const both = mount({ label: 'Name', 'aria-label': 'Other' });
    expect(inner(both).hasAttribute('aria-label')).toBe(false);
  });

  it('mirrors disabled, readonly, required and invalid to the textarea and internals', () => {
    const element = mount({ disabled: '', readonly: '', required: '', invalid: '' });
    const textarea = inner(element);

    expect(textarea.disabled).toBe(true);
    expect(textarea.readOnly).toBe(true);
    expect(textarea.required).toBe(true);
    expect(textarea.getAttribute('aria-disabled')).toBe('true');
    expect(textarea.getAttribute('aria-readonly')).toBe('true');
    expect(textarea.getAttribute('aria-required')).toBe('true');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(element.getAttribute('aria-disabled')).toBe('true');
    expect(element.getAttribute('aria-readonly')).toBe('true');
    expect(element.getAttribute('aria-required')).toBe('true');

    element.invalid = false;
    expect(inner(element).hasAttribute('aria-invalid')).toBe(false);
    expect(element.hasAttribute('aria-invalid')).toBe(false);
  });

  it('forwards rows and maxlength to the inner textarea', () => {
    const element = mount();
    expect(inner(element).getAttribute('rows')).toBe('3');
    expect(inner(element).hasAttribute('maxlength')).toBe(false);

    element.rows = 5;
    expect(inner(element).getAttribute('rows')).toBe('5');

    element.maxlength = 10;
    expect(inner(element).getAttribute('maxlength')).toBe('10');

    // Native semantics: -1 means "no limit", so the attribute goes away.
    element.maxlength = -1;
    expect(inner(element).hasAttribute('maxlength')).toBe(false);

    const seeded = mount({ rows: '8', maxlength: '140' });
    expect(inner(seeded).getAttribute('rows')).toBe('8');
    expect(inner(seeded).getAttribute('maxlength')).toBe('140');
  });

  it('drives resize from the attribute, defaulting to vertical', () => {
    const element = mount();
    expect(element.resize).toBe('vertical');
    expect(element.hasAttribute('resize')).toBe(false);

    element.resize = 'none';
    expect(inner(element).hasAttribute('resize')).toBe(false);
    element.resize = 'both';
    expect(element.getAttribute('resize')).toBe('both');
  });

  it('registers the value with the owning form so FormData carries it', () => {
    document.body.innerHTML =
      '<form><an-textarea name="bio" value="seed text"></an-textarea></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-textarea') as AnTextarea;

    expect(new FormData(form).get('bio')).toBe('seed text');

    type(element, 'next text');
    expect(new FormData(form).get('bio')).toBe('next text');
  });

  it('blocks requestSubmit while required and blank, then lets it through', () => {
    document.body.innerHTML = '<form><an-textarea name="q" required></an-textarea></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-textarea') as AnTextarea;
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
    expect(internalsState(element)!.flags).toEqual({ valueMissing: true });
    expect(internalsState(element)!.message).toBe('此字段为必填项。');
    expect(internalsState(element)!.anchor).toBe(inner(element));

    // Whitespace-only does not satisfy `required`, matching the platform.
    type(element, '   ');
    expect(internalsState(element)!.flags).toEqual({ valueMissing: true });

    type(element, 'filled');
    expect(internalsState(element)!.flags).toEqual({});
    form.requestSubmit();
    expect(invalids).toHaveLength(1);
    expect(submits).toHaveLength(1);
  });

  it('lets an empty read-only required field submit without a valueMissing flag', () => {
    document.body.innerHTML = '<form><an-textarea name="q" required readonly></an-textarea></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-textarea') as AnTextarea;
    const submits: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });

    expect(internalsState(element)!.flags).toEqual({});
    expect(internalsState(element)!.message).toBe('');
    form.requestSubmit();
    expect(submits).toHaveLength(1);
    expect(new FormData(form).has('q')).toBe(true);
  });

  it('keeps a read-only value in FormData while exempt from validation', () => {
    document.body.innerHTML =
      '<form><an-textarea name="q" value="seed" required readonly></an-textarea></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-textarea') as AnTextarea;
    const submits: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });

    expect(internalsState(element)!.flags).toEqual({});
    expect(new FormData(form).get('q')).toBe('seed');
    form.requestSubmit();
    expect(submits).toHaveLength(1);
  });

  it('restores the initial value on form.reset()', () => {
    document.body.innerHTML =
      '<form><an-textarea name="q" value="seed"></an-textarea></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-textarea') as AnTextarea;

    type(element, 'typed');
    expect(inner(element).value).toBe('typed');

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
    document.body.innerHTML =
      '<form><an-textarea name="q" value="seed" required></an-textarea></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-textarea') as AnTextarea;

    element.value = '';
    expect(internalsState(element)!.flags).toMatchObject({ valueMissing: true });
    form.reset();
    expect(element.value).toBe('seed');
    expect(internalsState(element)!.flags).toEqual({});
  });

  it('treats an ancestor <fieldset disabled> as the same barred state', () => {
    document.body.innerHTML =
      '<form><fieldset disabled><an-textarea name="q" required></an-textarea></fieldset></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-textarea') as AnTextarea;
    const submits: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });

    // The platform reports the ancestor `<fieldset disabled>` this way.
    element.formDisabledCallback(true);
    expect(inner(element).disabled).toBe(true);
    expect(inner(element).getAttribute('aria-disabled')).toBe('true');
    expect(internalsState(element)!.flags).toEqual({});
    expect(new FormData(form).has('q')).toBe(false);

    form.requestSubmit();
    expect(submits).toHaveLength(1);

    element.formDisabledCallback(false);
    expect(inner(element).disabled).toBe(false);
    expect(internalsState(element)!.flags).toMatchObject({ valueMissing: true });
  });

  it('keeps a host-level disabled in place when the fieldset is re-enabled', () => {
    const element = mount({ disabled: '' });
    element.formDisabledCallback(true);
    element.formDisabledCallback(false);
    expect(inner(element).disabled).toBe(true);
  });

  it('keeps the colour, hook and theme contract in an-textarea.css', () => {
    for (const hook of CSS_VARS) expect(textareaCssSource, hook).toContain(`var(${hook}`);
    expect(textareaCssSource).toContain('--an-color-bg-1');
    expect(textareaCssSource).toContain('--an-color-fg-1');
    expect(textareaCssSource).toContain('--an-color-border-1');
    expect(textareaCssSource).toContain('--an-color-accent-9');
    expect(textareaCssSource).toContain('--an-color-danger-9');
    expect(textareaCssSource).toContain('--an-space-2');
    expect(textareaCssSource).toContain('--an-radius-md');
    expect(textareaCssSource).toContain('--an-font-size-sm');
    expect(textareaCssSource).toContain(":host([data-theme='dark'])");
    expect(textareaCssSource).toContain(":host([data-theme='light'])");
    expect(textareaCssSource).toContain('resize: vertical');
    expect(textareaCssSource).toContain(":host([resize='none'])");
    expect(textareaCssSource).toContain(":host([resize='both'])");
  });
});

// ---------------------------------------------------------------------------
// Enhancement contract: auto-size / min-rows / max-rows / show-count /
// autocomplete. Written against the documented API, not the current code.
// ---------------------------------------------------------------------------

/** The character counter, once the component paints one. */
function counter(element: AnTextarea): HTMLElement | null {
  return element.shadowRoot!.querySelector<HTMLElement>('[part~="count"]');
}

/** The pixel height the component wrote onto the inner textarea. */
function writtenHeight(element: AnTextarea): string {
  return inner(element).style.height;
}

const textareaLayoutMocks: Array<ReturnType<typeof vi.spyOn>> = [];

afterEach(() => {
  for (const mock of textareaLayoutMocks.splice(0)) mock.mockRestore();
});

/** Supplies real scrollHeight semantics in happy-dom, which has no layout. */
function mockTextareaLayout(boxSizing: 'border-box' | 'content-box' = 'border-box'): void {
  textareaLayoutMocks.push(vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLTextAreaElement) {
    const height = Math.max(parseFloat(this.style.height) || 0, parseFloat(this.style.minHeight) || 0);
    const clientHeight = boxSizing === 'border-box' ? height - 5 : height + 16;
    const textHeight = this.value.split('\n').length * 20;
    return Math.max(clientHeight, textHeight + 16);
  }));
  const getStyle = globalThis.getComputedStyle;
  textareaLayoutMocks.push(vi.spyOn(globalThis, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const css = getStyle(element, pseudo);
    if (!(element instanceof HTMLTextAreaElement)) return css;
    const overrides = {
      boxSizing,
      lineHeight: '20px',
      paddingTop: '6px',
      paddingBottom: '10px',
      borderTopWidth: '2px',
      borderBottomWidth: '3px',
    };
    return new Proxy(css, {
      get(target, key) {
        if (Object.hasOwn(overrides, key)) return overrides[key as keyof typeof overrides];
        return Reflect.get(target, key, target);
      },
    });
  }));
}

describe('an-textarea — auto-size', () => {
  it.each([
    { boxSizing: 'border-box' as const, shortHeight: '41px', tallHeight: '261px' },
    { boxSizing: 'content-box' as const, shortHeight: '20px', tallHeight: '240px' },
  ])('grows, shrinks and stays stable across repeated input with $boxSizing', ({ boxSizing, shortHeight, tallHeight }) => {
    mockTextareaLayout(boxSizing);
    const element = mount({ 'auto-size': '' });
    const textarea = inner(element);
    textarea.style.setProperty('min-height', '70px', 'important');
    textarea.focus();

    type(element, 'a');
    const first = writtenHeight(element);
    type(element, Array.from({ length: 12 }, () => 'a').join('\n'));
    const grown = writtenHeight(element);
    type(element, 'a');
    const shrunk = writtenHeight(element);
    textarea.setSelectionRange(0, 1, 'backward');
    fire(textarea, 'input');

    expect([first, grown, shrunk, writtenHeight(element)]).toEqual([
      shortHeight, tallHeight, shortHeight, shortHeight,
    ]);
    expect(inner(element)).toBe(textarea);
    expect([textarea.selectionStart, textarea.selectionEnd, textarea.selectionDirection]).toEqual([0, 1, 'backward']);
    expect(textarea.style.minHeight).toBe('70px');
    expect(textarea.style.getPropertyPriority('min-height')).toBe('important');
  });

  it('clamps content before adding the padding and border, and clears inline sizing when disabled', () => {
    mockTextareaLayout();
    const element = mount({ 'auto-size': '', 'min-rows': '2', 'max-rows': '4' });
    const textarea = inner(element);

    type(element, 'a');
    expect(writtenHeight(element)).toBe('61px');
    expect(textarea.style.overflowY).toBe('');
    type(element, Array.from({ length: 12 }, () => 'a').join('\n'));
    expect(writtenHeight(element)).toBe('101px');
    expect(textarea.style.overflowY).toBe('auto');
    textarea.scrollTop = 35;
    fire(textarea, 'input');
    expect(textarea.scrollTop).toBe(35);

    element.autoSize = false;
    expect(writtenHeight(element)).toBe('');
    expect(inner(element).style.overflowY).toBe('');
  });
  it('is off by default and leaves the inline height alone', () => {
    const element = mount({ rows: '3' });

    expect(element.autoSize).toBe(false);
    type(element, 'one\ntwo\nthree\nfour\nfive');
    expect(writtenHeight(element)).toBe('');
  });

  it('does not impose an estimated height on an unmeasurable control', () => {
    const element = mount({ 'auto-size': '' });
    expect(inner(element).scrollHeight).toBe(0);
    type(element, 'a\nb\nc\nd');
    expect(writtenHeight(element)).toBe('');
    expect(inner(element).style.overflowY).toBe('');
  });

  it('grows the height as lines are added', () => {
    mockTextareaLayout();
    const element = mount({ 'auto-size': '' });

    expect(element.autoSize).toBe(true);
    type(element, 'a');
    const one = writtenHeight(element);
    type(element, 'a\nb\nc\nd');
    const four = writtenHeight(element);

    expect(one).not.toBe('');
    expect(four).not.toBe('');
    expect(parseInt(four, 10)).toBeGreaterThan(parseInt(one, 10));
  });

  it('shrinks back when lines are removed', () => {
    mockTextareaLayout();
    const element = mount({ 'auto-size': '' });
    type(element, 'a\nb\nc\nd\ne');
    const tall = parseInt(writtenHeight(element), 10);

    type(element, 'a');
    const short = parseInt(writtenHeight(element), 10);

    expect(short).toBeLessThan(tall);
  });

  it('honours `min-rows` as a floor', () => {
    mockTextareaLayout();
    const element = mount({ 'auto-size': '', 'min-rows': '4' });
    type(element, 'a');

    expect(writtenHeight(element)).toBe('101px');
  });

  it('honours `max-rows` as a ceiling and starts scrolling instead', () => {
    mockTextareaLayout();
    const element = mount({ 'auto-size': '', 'max-rows': '3' });
    type(element, Array.from({ length: 20 }, (_, index) => `line ${index}`).join('\n'));

    expect(writtenHeight(element)).toBe('81px');
    expect(inner(element).style.overflowY).toBe('auto');
  });

  it('recomputes the height after a form reset', () => {
    mockTextareaLayout();
    // Precondition, asserted up front so a missing `reset()` fails loudly here
    // instead of silently turning the rest of this case into a no-op.
    expect(typeof AnTextarea.prototype.reset).toBe('function');

    const form = document.createElement('form');
    document.body.append(form);
    const element = document.createElement('an-textarea') as AnTextarea;
    expect(typeof element.reset).toBe('function');
    element.setAttribute('auto-size', '');
    element.setAttribute('value', 'a');
    form.append(element);

    type(element, 'a\nb\nc\nd\ne');
    const tall = parseInt(writtenHeight(element), 10);

    form.reset();

    expect(element.value).toBe('a');
    expect(parseInt(writtenHeight(element), 10)).toBeLessThan(tall);
  });

  it('exposes `reset()` on the element, not only through `form.reset()`', () => {
    const element = mount({ value: 'a' });
    expect(typeof element.reset).toBe('function');

    type(element, 'changed');
    element.reset();

    expect(element.value).toBe('a');
    expect(inner(element).value).toBe('a');
  });
});

describe('an-textarea — show-count', () => {
  it('paints no counter by default', () => {
    const element = mount({ value: 'ada' });
    expect(element.showCount).toBe(false);
    expect(counter(element)).toBeNull();
  });

  it('shows `length/maxlength` with a limit', () => {
    const element = mount({ 'show-count': '', maxlength: '10', value: 'ada' });

    expect(counter(element)).not.toBeNull();
    expect(counter(element)!.textContent?.trim()).toBe('3/10');
  });

  it('shows the bare length without a limit and follows typing', () => {
    const element = mount({ 'show-count': '' });
    expect(counter(element)!.textContent?.trim()).toBe('0');

    type(element, 'ada');
    expect(counter(element)!.textContent?.trim()).toBe('3');
  });
});

describe('an-textarea — autocomplete forwarding', () => {
  it('forwards `autocomplete` to the inner textarea', () => {
    const element = mount({ autocomplete: 'street-address' });
    expect(inner(element).getAttribute('autocomplete')).toBe('street-address');

    element.autocomplete = 'off';
    expect(inner(element).getAttribute('autocomplete')).toBe('off');

    element.autocomplete = '';
    expect(inner(element).hasAttribute('autocomplete')).toBe(false);
  });
});

describe('an-textarea — min-rows / max-rows attributes', () => {
  it('reflects the row bounds as properties', () => {
    const element = mount({ 'min-rows': '2', 'max-rows': '8' });

    expect(element.minRows).toBe(2);
    expect(element.maxRows).toBe(8);
  });

  it('defaults to no bound', () => {
    const element = mount();
    expect(element.minRows).toBe(0);
    expect(element.maxRows).toBe(0);
  });
});
