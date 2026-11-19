/** @vitest-environment happy-dom */
// The shim must be installed before the component constructors run, so that
// form-associated elements find `attachInternals()`. Static imports run in
// source order.
import './helpers/form-internals';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnButton } from '../src/button/an-button';
import { AnCheckbox } from '../src/checkbox/an-checkbox';
import { AnForm } from '../src/form/an-form';

if (!customElements.get('an-button')) {
  customElements.define('an-button', AnButton);
}
if (!customElements.get('an-checkbox')) {
  customElements.define('an-checkbox', AnCheckbox);
}
if (!customElements.get('an-form')) {
  customElements.define('an-form', AnForm);
}

/**
 * Minimal control that speaks the `<an-form>` protocol. Its `value` is a
 * comma-separated list, so one control can append several entries under the
 * same name (the multi-value case).
 */
class FakeControl extends HTMLElement {
  static formAssociated = true;

  #valid = true;

  /** Message returned while invalid. */
  message = '请填写此项';

  /** Serialized value; comma-separated values become repeated entries. */
  value = '';

  checkCalls = 0;
  reportCalls = 0;
  resetCalls = 0;
  focusCalls = 0;
  scrollCalls: Array<boolean | ScrollIntoViewOptions> = [];

  get valid(): boolean {
    return this.#valid;
  }

  set valid(next: boolean) {
    this.#valid = next;
  }

  get validationMessage(): string {
    return this.#valid ? '' : this.message;
  }

  checkValidity(): boolean {
    this.checkCalls += 1;
    return this.#valid;
  }

  reportValidity(): boolean {
    this.reportCalls += 1;
    return this.#valid;
  }

  reset(): void {
    this.resetCalls += 1;
    this.value = '';
  }

  getFormData(): FormData {
    const data = new FormData();
    const name = this.getAttribute('name');
    if (!name) return data;
    for (const value of this.value.split(',').filter(Boolean)) data.append(name, value);
    return data;
  }

  scrollIntoView(arg?: boolean | ScrollIntoViewOptions): void {
    this.scrollCalls.push(arg ?? {});
  }

  focus(options?: FocusOptions): void {
    void options;
    this.focusCalls += 1;
  }
}

/** A control whose real focusable node lives in its shadow root. */
class ShadowControl extends HTMLElement {
  static formAssociated = true;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = '<input>';
  }

  checkValidity(): boolean {
    return false;
  }

  get validationMessage(): string {
    return '请检查';
  }
}

if (!customElements.get('an-test-control')) {
  customElements.define('an-test-control', FakeControl);
}
if (!customElements.get('an-shadow-control')) {
  customElements.define('an-shadow-control', ShadowControl);
}

function createForm(attributes: Record<string, string> = {}): AnForm {
  const form = document.createElement('an-form') as AnForm;
  for (const [name, value] of Object.entries(attributes)) form.setAttribute(name, value);
  document.body.append(form);
  return form;
}

function createControl(
  name: string,
  options: { value?: string; valid?: boolean; message?: string } = {},
): FakeControl {
  const control = document.createElement('an-test-control') as FakeControl;
  if (name) control.setAttribute('name', name);
  if (options.value !== undefined) control.value = options.value;
  if (options.valid === false) control.valid = false;
  if (options.message !== undefined) control.message = options.message;
  return control;
}

function createButton(type: string, attributes: Record<string, string> = {}): AnButton {
  const button = document.createElement('an-button') as AnButton;
  button.setAttribute('type', type);
  for (const [name, value] of Object.entries(attributes)) button.setAttribute(name, value);
  button.textContent = type;
  return button;
}

/** Clicks the native button inside `<an-button>`, the way a pointer would. */
function clickInner(button: AnButton): boolean {
  const inner = button.shadowRoot!.querySelector('button');
  if (!inner) throw new Error('an-button did not render its native button');
  return inner.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }),
  );
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('an-form — host contract', () => {
  it('works without a shadow root and makes the host a transparent container', () => {
    const form = createForm();

    expect(form.shadowRoot).toBeNull();
    expect(form instanceof HTMLElement).toBe(true);
    const styles = document.getElementById('an-form-styles');
    expect(styles).not.toBeNull();
    expect(styles!.textContent).toContain('an-form { display: contents; }');
  });

  it('starts with novalidate and loading off', () => {
    const form = createForm();

    expect(form.novalidate).toBe(false);
    expect(form.loading).toBe(false);
    expect(form.hasAttribute('novalidate')).toBe(false);
    expect(form.hasAttribute('loading')).toBe(false);
  });

  it('reflects novalidate and loading between attribute and property', () => {
    const form = createForm();

    form.novalidate = true;
    expect(form.hasAttribute('novalidate')).toBe(true);
    form.setAttribute('novalidate', '');
    form.novalidate = false;
    expect(form.hasAttribute('novalidate')).toBe(false);

    form.setAttribute('loading', '');
    expect(form.loading).toBe(true);
    form.loading = false;
    expect(form.hasAttribute('loading')).toBe(false);
  });

  it('exposes loading without touching its submit buttons', () => {
    const form = createForm();
    const button = createButton('submit');
    form.append(button);

    form.loading = true;
    expect(button.hasAttribute('loading')).toBe(false);
    expect(button.loading).toBe(false);
  });
});

describe('an-form — validate', () => {
  it('summarizes every invalid control without reporting anything', () => {
    const form = createForm();
    const one = createControl('one', { valid: false, message: '第一项错误' });
    const two = createControl('two', { valid: true });
    const three = createControl('three', { valid: false, message: '第三项错误' });
    form.append(one, two, three);

    const result = form.validate();

    expect(result.valid).toBe(false);
    expect(result.fields.map((field) => field.name)).toEqual(['one', 'three']);
    expect(result.fields.map((field) => field.message)).toEqual(['第一项错误', '第三项错误']);
    expect(result.fields[0].element).toBe(one);
    expect(one.reportCalls).toBe(0);
    expect(three.reportCalls).toBe(0);
  });

  it('reports valid when every control passes', () => {
    const form = createForm();
    form.append(createControl('one'), createControl('two'));

    expect(form.validate()).toEqual({ valid: true, fields: [] });
  });

  it('falls back to a Chinese message when a control exposes none', () => {
    const form = createForm();
    const control = createControl('one', { valid: false });
    control.message = '';
    form.append(control);

    expect(form.validate().fields[0].message).toBe('请输入有效值');
  });

  it('skips descendants of another control', () => {
    const form = createForm();
    const outer = createControl('outer', { valid: false });
    const inner = createControl('inner', { valid: false });
    outer.append(inner);
    form.append(outer);

    const names = form.validate().fields.map((field) => field.name);
    expect(names).toEqual(['outer']);
  });

  it('ignores controls that belong to a nested an-form', () => {
    const outer = createForm();
    const inner = document.createElement('an-form') as AnForm;
    const control = createControl('inner', { valid: false });
    inner.append(control);
    outer.append(inner);

    expect(outer.validate()).toEqual({ valid: true, fields: [] });
    expect(inner.validate().fields.map((field) => field.name)).toEqual(['inner']);
  });
});

describe('an-form — submit', () => {
  it('announces the merged FormData and a JSON-safe values snapshot', () => {
    const form = createForm();
    form.append(createControl('name', { value: 'ada' }), createControl('tags', { value: 'a,b' }));
    const seen: CustomEvent[] = [];
    document.addEventListener('an-form-submit', (event) => seen.push(event as CustomEvent));

    expect(form.submit()).toBe(true);

    expect(seen).toHaveLength(1);
    const detail = seen[0].detail as { formData: FormData; values: Record<string, unknown> };
    expect(detail.formData.get('name')).toBe('ada');
    expect(detail.formData.getAll('tags')).toEqual(['a', 'b']);
    expect(seen[0].bubbles).toBe(true);
    expect(seen[0].composed).toBe(true);
    expect(Object.getPrototypeOf(detail.values)).toBe(Object.prototype);
    expect(detail.values).toEqual({ name: 'ada', tags: ['a', 'b'] });
    expect(JSON.parse(JSON.stringify(detail.values))).toEqual({
      name: 'ada',
      tags: ['a', 'b'],
    });
  });

  it('reports invalid controls, blocks the submit event and returns false', () => {
    const form = createForm();
    const bad = createControl('bad', { valid: false, message: '请选择' });
    const good = createControl('good');
    form.append(bad, good);
    const seen: CustomEvent[] = [];
    document.addEventListener('an-form-invalid', (event) => seen.push(event as CustomEvent));

    expect(form.submit()).toBe(false);

    expect(bad.reportCalls).toBe(1);
    expect(good.reportCalls).toBe(0);
    expect(seen).toHaveLength(1);
    expect((seen[0].detail as { fields: Array<{ name: string }> }).fields.map((f) => f.name)).toEqual([
      'bad',
    ]);
    expect(seen[0].bubbles).toBe(true);
    expect(seen[0].composed).toBe(true);
    expect(form.getFormData().has('bad')).toBe(false);
  });

  it('focuses the first problem and scrolls it into view in the middle', () => {
    const form = createForm();
    const bad = createControl('bad', { valid: false });
    const other = createControl('other', { valid: false });
    form.append(bad, other);

    form.submit();

    expect(bad.scrollCalls).toHaveLength(1);
    expect(bad.scrollCalls[0]).toMatchObject({ block: 'center', behavior: 'smooth' });
    expect(bad.focusCalls).toBe(1);
    expect(other.focusCalls).toBe(0);
  });

  it('focuses the focusable node inside a shadow root', () => {
    const form = createForm();
    const control = document.createElement('an-shadow-control') as ShadowControl;
    control.setAttribute('name', 'shadow');
    form.append(control);

    form.submit();

    expect(control.shadowRoot!.activeElement?.localName).toBe('input');
  });

  it('respects prefers-reduced-motion for the scroll', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query }));
    const form = createForm();
    const bad = createControl('bad', { valid: false });
    form.append(bad);

    form.submit();

    expect(bad.scrollCalls[0]).toMatchObject({ block: 'center', behavior: 'auto' });
  });

  it('skips validation entirely with novalidate', () => {
    const form = createForm({ novalidate: '' });
    const control = createControl('bad', { valid: false });
    form.append(control);
    const invalidEvents = vi.fn();
    document.addEventListener('an-form-invalid', invalidEvents);

    expect(form.submit()).toBe(true);

    expect(control.checkCalls).toBe(0);
    expect(control.reportCalls).toBe(0);
    expect(invalidEvents).not.toHaveBeenCalled();
    expect(form.getFormData().get('bad')).toBe(null);
  });

  it('returns a boolean and emits nothing when there are no controls', () => {
    const form = createForm();
    const seen = vi.fn();
    document.addEventListener('an-form-submit', seen);

    expect(form.submit()).toBe(true);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe('an-form — reset and getFormData', () => {
  it('resets every control and announces it', () => {
    const form = createForm();
    const one = createControl('one', { value: 'ada' });
    const two = createControl('two', { value: 'lin' });
    form.append(one, two);
    const seen: CustomEvent[] = [];
    document.addEventListener('an-form-reset', (event) => seen.push(event as CustomEvent));

    form.reset();

    expect(one.resetCalls).toBe(1);
    expect(two.resetCalls).toBe(1);
    expect(one.value).toBe('');
    expect(two.value).toBe('');
    expect(form.getFormData().get('one')).toBe(null);
    expect(seen).toHaveLength(1);
    expect(seen[0].bubbles).toBe(true);
    expect(seen[0].composed).toBe(true);
  });

  it('serializes real controls through their own getFormData()', () => {
    const form = createForm();
    const checkbox = document.createElement('an-checkbox') as AnCheckbox;
    checkbox.setAttribute('name', 'remember');
    checkbox.setAttribute('value', 'yes');
    checkbox.setAttribute('checked', '');
    form.append(checkbox);

    const data = form.getFormData();

    expect(data.get('remember')).toBe('yes');
    expect(form.validate().valid).toBe(true);
  });
});

describe('an-form — button interception', () => {
  it('routes an orphan submit button through submit() and cancels the click', () => {
    const form = createForm();
    form.append(createButton('submit'));
    const seen = vi.fn();
    form.addEventListener('an-form-submit', seen);

    const notCanceled = clickInner(form.querySelector('an-button') as AnButton);

    expect(notCanceled).toBe(false);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('routes an orphan reset button through reset()', () => {
    const form = createForm();
    const control = createControl('one', { value: 'ada' });
    const button = createButton('reset');
    form.append(control, button);
    const seen = vi.fn();
    form.addEventListener('an-form-reset', seen);

    const notCanceled = clickInner(button);

    expect(notCanceled).toBe(false);
    expect(control.resetCalls).toBe(1);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('leaves other button types alone', () => {
    const form = createForm();
    const button = createButton('button');
    form.append(button);
    const submit = vi.fn();
    const reset = vi.fn();
    document.addEventListener('an-form-submit', submit);
    document.addEventListener('an-form-reset', reset);

    expect(clickInner(button)).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it('leaves a button with a real form owner to the platform', () => {
    const realForm = document.createElement('form');
    realForm.id = 'owner';
    document.body.append(realForm);
    const form = createForm();
    const button = createButton('submit', { form: 'owner' });
    form.append(button);
    const seen = vi.fn();
    form.addEventListener('an-form-submit', seen);

    expect(clickInner(button)).toBe(true);
    expect(seen).not.toHaveBeenCalled();
  });

  it('ignores disabled and loading buttons', () => {
    const form = createForm();
    const disabled = createButton('submit', { disabled: '' });
    const loading = createButton('reset', { loading: '' });
    form.append(disabled, loading);
    const seen = vi.fn();
    document.addEventListener('an-form-submit', seen);
    document.addEventListener('an-form-reset', seen);

    clickInner(disabled);
    clickInner(loading);
    expect(seen).not.toHaveBeenCalled();
  });

  it('does not double-handle a button owned by a nested an-form', () => {
    const outer = createForm();
    const inner = document.createElement('an-form') as AnForm;
    const button = createButton('submit');
    inner.append(button);
    outer.append(inner);
    const seen = vi.fn();
    document.addEventListener('an-form-submit', seen);

    clickInner(button);

    expect(seen).toHaveBeenCalledTimes(1);
  });
});
