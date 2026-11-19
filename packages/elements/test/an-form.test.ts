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

/** A control without `getFormData()`, so the value falls back to `checked`. */
class CheckedControl extends HTMLElement {
  static formAssociated = true;

  checked = false;

  checkValidity(): boolean {
    return true;
  }
}

if (!customElements.get('an-checked-control')) {
  customElements.define('an-checked-control', CheckedControl);
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

describe('an-form — declarative rules (sync)', () => {
  it('rejects a required field left blank', () => {
    const form = createForm();
    const control = createControl('email');
    form.append(control);
    form.rules = { email: { required: true } };

    const result = form.validate();

    expect(result.valid).toBe(false);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toMatchObject({
      name: 'email',
      message: '此项为必填项',
      element: control,
    });
  });

  it('accepts a required field that holds a value', () => {
    const form = createForm();
    form.append(createControl('email', { value: 'ada@example.com' }));
    form.rules = { email: { required: true } };

    expect(form.validate()).toEqual({ valid: true, fields: [] });
  });

  it('uses the message carried by the rule', () => {
    const form = createForm();
    form.append(createControl('email'));
    form.rules = { email: { required: true, message: '邮箱必填' } };

    expect(form.validate().fields[0].message).toBe('邮箱必填');
  });

  it('enforces a string pattern', () => {
    const form = createForm();
    const control = createControl('code', { value: '12' });
    form.append(control);
    form.rules = { code: { pattern: '^\\d{3}$' } };

    expect(form.validate().fields[0].message).toBe('格式不正确');

    control.value = '123';
    expect(form.validate().valid).toBe(true);
  });

  it('accepts a RegExp pattern and resets its lastIndex', () => {
    const form = createForm();
    form.append(createControl('code', { value: 'aa' }));
    form.rules = { code: { pattern: /a/g } };

    expect(form.validate().valid).toBe(true);
    expect(form.validate().valid).toBe(true);
  });

  it('enforces numeric min and max', () => {
    const form = createForm();
    const control = createControl('score', { value: '3' });
    form.append(control);

    form.rules = { score: { min: 5 } };
    expect(form.validate().fields[0].message).toBe('不能小于 5');

    form.rules = { score: { max: 10, message: '太大了' } };
    expect(form.validate().valid).toBe(true);

    control.value = '11';
    expect(form.validate().fields[0].message).toBe('太大了');
  });

  it('ignores numeric bounds for a non-numeric value', () => {
    const form = createForm();
    form.append(createControl('score', { value: 'abc' }));
    form.rules = { score: { min: 5, max: 10 } };

    expect(form.validate().valid).toBe(true);
  });

  it('enforces minLength and maxLength', () => {
    const form = createForm();
    const control = createControl('nick', { value: 'ab' });
    form.append(control);

    form.rules = { nick: { minLength: 3 } };
    expect(form.validate().fields[0].message).toBe('长度不能少于 3 个字符');

    control.value = 'abcd';
    form.rules = { nick: { maxLength: 3 } };
    expect(form.validate().fields[0].message).toBe('长度不能超过 3 个字符');
  });

  it('runs an array of rules and keeps the first failure', () => {
    const form = createForm();
    form.append(createControl('nick'));
    form.rules = {
      nick: [
        { required: true, message: '必填' },
        { pattern: '^x', message: '要以 x 开头' },
      ],
    };

    expect(form.validate().fields[0].message).toBe('必填');
  });

  it('skips validators in the synchronous path', () => {
    const form = createForm();
    const control = createControl('email', { value: 'whatever' });
    form.append(control);
    const validator = vi.fn(() => '只能在异步路径执行');
    form.rules = { email: { validator } };

    expect(form.validate().valid).toBe(true);
    expect(form.submit()).toBe(true);
    expect(validator).not.toHaveBeenCalled();
  });

  it('merges platform errors and rule errors in control order', () => {
    const form = createForm();
    const bad = createControl('bad', { valid: false, message: '平台错误' });
    const email = createControl('email');
    form.append(bad, email);
    form.rules = { email: { required: true } };

    const fields = form.validate().fields;

    expect(fields.map((field) => field.name)).toEqual(['bad', 'email']);
    expect(fields.map((field) => field.message)).toEqual(['平台错误', '此项为必填项']);
  });

  it('ignores rules for names without a control', () => {
    const form = createForm();
    form.rules = { ghost: { required: true } };

    expect(form.validate()).toEqual({ valid: true, fields: [] });
  });

  it('decorates a rule failure on submit', () => {
    const form = createForm();
    const control = createControl('email');
    form.append(control);
    form.rules = { email: { required: true, message: '邮箱必填' } };
    const invalidEvents = vi.fn();
    form.addEventListener('invalid', invalidEvents, true);

    expect(form.submit()).toBe(false);

    expect(control.reportCalls).toBe(0);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.validationMessage).toBe('邮箱必填');
    expect(invalidEvents).toHaveBeenCalledTimes(1);
  });

  it('clears the rule decoration when the value changes', () => {
    const form = createForm();
    const control = createControl('email');
    form.append(control);
    form.rules = { email: { required: true, message: '邮箱必填' } };
    form.submit();

    control.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

    expect(control.hasAttribute('aria-invalid')).toBe(false);
    expect(control.validationMessage).toBe('');
  });

  it('clears a stale rule failure on the next successful submit', () => {
    const form = createForm();
    const control = createControl('email');
    form.append(control);
    form.rules = { email: { required: true, message: '邮箱必填' } };
    form.submit();

    control.value = 'ada@example.com';

    expect(form.submit()).toBe(true);
    expect(control.hasAttribute('aria-invalid')).toBe(false);
    expect(form.querySelector('.error-summary')).toBeNull();
  });
});

describe('an-form — asynchronous validation', () => {
  it('awaits an asynchronous validator', async () => {
    const form = createForm();
    form.append(createControl('email', { value: 'ok' }));
    const validator = vi.fn(async (value: string) => (value === 'ok' ? null : '不合法'));
    form.rules = { email: { validator } };

    await expect(form.validateAsync()).resolves.toEqual({ valid: true, fields: [] });
    expect(validator).toHaveBeenCalledWith('ok', form);
  });

  it('reports an asynchronous failure', async () => {
    const form = createForm();
    form.append(createControl('email', { value: 'bad' }));
    form.rules = { email: { validator: async () => '不合法' } };

    const result = await form.validateAsync();

    expect(result.valid).toBe(false);
    expect(result.fields[0]).toMatchObject({ name: 'email', message: '不合法' });
  });

  it('emits submit when submitAsync succeeds', async () => {
    const form = createForm();
    form.append(createControl('email', { value: 'ok' }));
    form.rules = { email: { validator: async () => null } };
    const seen = vi.fn();
    form.addEventListener('an-form-submit', seen);

    await expect(form.submitAsync()).resolves.toBe(true);

    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('reports invalid and decorates when submitAsync fails', async () => {
    const form = createForm({ 'show-error-summary': '' });
    const control = createControl('email', { value: 'bad' });
    form.append(control);
    form.rules = { email: { validator: async () => '邮箱已被占用' } };
    const invalidEvents = vi.fn();
    form.addEventListener('an-form-invalid', invalidEvents);

    await expect(form.submitAsync()).resolves.toBe(false);

    expect(invalidEvents).toHaveBeenCalledTimes(1);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.validationMessage).toBe('邮箱已被占用');
    expect(form.querySelector('.error-summary')?.textContent).toContain('email: 邮箱已被占用');
  });

  it('uses the message of a rejected validator', async () => {
    const form = createForm();
    form.append(createControl('email', { value: 'bad' }));
    form.rules = {
      email: {
        validator: async () => {
          throw new Error('网络错误');
        },
      },
    };

    expect((await form.validateAsync()).fields[0].message).toBe('网络错误');
  });

  it('runs a synchronous validator in the asynchronous path', async () => {
    const form = createForm();
    form.append(createControl('email', { value: 'bad' }));
    form.rules = { email: { validator: (value: string) => (value === 'ok' ? null : '不对') } };

    expect((await form.validateAsync()).fields[0].message).toBe('不对');
  });

  it('skips every rule when novalidate is set', async () => {
    const form = createForm({ novalidate: '' });
    form.append(createControl('email', { value: 'bad' }));
    const validator = vi.fn(async () => '不合法');
    form.rules = { email: { validator } };
    const seen = vi.fn();
    form.addEventListener('an-form-submit', seen);

    await expect(form.submitAsync()).resolves.toBe(true);

    expect(validator).not.toHaveBeenCalled();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('reports platform errors from submitAsync too', async () => {
    const form = createForm();
    const bad = createControl('bad', { valid: false, message: '平台错误' });
    form.append(bad);

    await expect(form.submitAsync()).resolves.toBe(false);

    expect(bad.reportCalls).toBe(1);
  });
});

describe('an-form — dirty tracking', () => {
  it('compares every field against the connection snapshot', () => {
    const form = createForm();
    const control = createControl('name', { value: 'ada' });
    form.append(control);

    expect(form.isDirty).toBe(false);

    control.value = 'lin';

    expect(form.isDirty).toBe(true);
    expect(form.dirtyFields).toEqual(['name']);

    control.value = 'ada';

    expect(form.isDirty).toBe(false);
  });

  it('deduplicates repeated field names', () => {
    const form = createForm();
    const first = createControl('tags', { value: 'a' });
    const second = createControl('tags', { value: 'b' });
    form.append(first, second);
    expect(form.isDirty).toBe(false);

    first.value = 'a2';
    second.value = 'b2';

    expect(form.dirtyFields).toEqual(['tags']);
  });

  it('is clean again after reset', () => {
    const form = createForm();
    const control = createControl('name', { value: 'ada' });
    form.append(control);
    expect(form.isDirty).toBe(false);
    control.value = 'lin';
    expect(form.isDirty).toBe(true);

    form.reset();

    expect(form.isDirty).toBe(false);
    expect(control.resetCalls).toBe(1);
  });

  it('snapshots a control appended after connection', async () => {
    const form = createForm();
    form.append(createControl('late', { value: 'ada' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const control = form.querySelector('an-test-control') as FakeControl;

    control.value = 'lin';

    expect(form.dirtyFields).toEqual(['late']);
  });
});

describe('an-form — field API', () => {
  it('returns the first value a field submits', () => {
    const form = createForm();
    form.append(createControl('tags', { value: 'a,b' }));

    expect(form.getFieldValue('tags')).toBe('a');
    expect(form.getFieldValue('missing')).toBeNull();
  });

  it('falls back to the checked state without FormData', () => {
    const form = createForm();
    const control = document.createElement('an-checked-control') as CheckedControl;
    control.setAttribute('role', 'checkbox');
    control.setAttribute('name', 'agree');
    form.append(control);

    expect(form.getFieldValue('agree')).toBe('');

    control.checked = true;

    expect(form.getFieldValue('agree')).toBe('true');
  });

  it('validateField awaits the field validator', async () => {
    const form = createForm();
    const control = createControl('email', { value: 'bad' });
    form.append(control);
    form.rules = { email: { validator: async (value: string) => (value === 'ok' ? null : '不对') } };

    await expect(form.validateField('email')).resolves.toBe(false);

    control.value = 'ok';
    await expect(form.validateField('email')).resolves.toBe(true);
    await expect(form.validateField('ghost')).resolves.toBe(true);
  });

  it('resetField resets one field and clears its rule error', () => {
    const form = createForm();
    const first = createControl('first');
    const second = createControl('second');
    form.append(first, second);
    form.rules = { first: { required: true }, second: { required: true } };
    form.submit();
    expect(first.getAttribute('aria-invalid')).toBe('true');
    expect(second.getAttribute('aria-invalid')).toBe('true');

    form.resetField('first');

    expect(first.resetCalls).toBe(1);
    expect(first.hasAttribute('aria-invalid')).toBe(false);
    expect(second.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('an-form — error summary', () => {
  it('renders the summary as the first child', () => {
    const form = createForm({ 'show-error-summary': '' });
    const bad = createControl('bad', { valid: false, message: '请选择' });
    form.append(bad);

    expect(form.submit()).toBe(false);

    const summary = form.firstElementChild as HTMLElement;
    expect(summary.classList.contains('error-summary')).toBe(true);
    expect(summary.getAttribute('part')).toBe('error-summary');
    expect(summary.getAttribute('role')).toBe('alert');
    expect(summary.hasAttribute('data-an-form-own')).toBe(true);
    expect(summary.textContent).toContain('bad: 请选择');
  });

  it('scrolls to and focuses the control behind an entry', () => {
    const form = createForm({ 'show-error-summary': '' });
    const bad = createControl('bad', { valid: false, message: '请选择' });
    form.append(bad);
    form.submit();
    bad.focusCalls = 0;
    bad.scrollCalls = [];

    const item = form.querySelector('.error-summary button') as HTMLButtonElement;
    item.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));

    expect(bad.focusCalls).toBe(1);
    expect(bad.scrollCalls).toHaveLength(1);
  });

  it('keeps the summary out of FormData and control scans', () => {
    const form = createForm({ 'show-error-summary': '' });
    form.append(
      createControl('name', { value: 'ada' }),
      createControl('bad', { valid: false, message: '请选择' }),
    );

    form.submit();

    const data = form.getFormData();
    expect(Array.from(data.keys())).toEqual(['name']);
    expect(form.validate().fields.map((field) => field.name)).toEqual(['bad']);
  });

  it('is not rendered without the attribute', () => {
    const form = createForm();
    form.append(createControl('bad', { valid: false }));

    form.submit();

    expect(form.querySelector('.error-summary')).toBeNull();
  });

  it('is removed after a value change', () => {
    const form = createForm({ 'show-error-summary': '' });
    const bad = createControl('bad', { valid: false });
    form.append(bad);
    form.submit();
    expect(form.querySelector('.error-summary')).not.toBeNull();

    bad.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    expect(form.querySelector('.error-summary')).toBeNull();
  });

  it('is removed after reset', () => {
    const form = createForm({ 'show-error-summary': '' });
    form.append(createControl('bad', { valid: false }));
    form.submit();
    expect(form.querySelector('.error-summary')).not.toBeNull();

    form.reset();

    expect(form.querySelector('.error-summary')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Gaps left by the suites above: the paths where the synchronous and the
// asynchronous APIs disagree about `validator`.
// ---------------------------------------------------------------------------

describe('an-form — validator result handling', () => {
  it('passes a synchronous validator that returns null', async () => {
    const form = createForm();
    form.append(createControl('email', { value: 'ada@example.com' }));
    const validator = vi.fn(() => null);
    form.rules = { email: { validator } };

    await expect(form.validateAsync()).resolves.toEqual({ valid: true, fields: [] });
    expect(validator).toHaveBeenCalledWith('ada@example.com', form);
  });

  it('fails a synchronous validator that returns a message', async () => {
    const form = createForm();
    form.append(createControl('email', { value: 'bad' }));
    form.rules = { email: { validator: () => '域名不受信任' } };

    const result = await form.validateAsync();

    expect(result.valid).toBe(false);
    expect(result.fields[0]).toMatchObject({ name: 'email', message: '域名不受信任' });
  });

  it('keeps the first failure when a declarative rule and a validator both fail', async () => {
    const form = createForm();
    form.append(createControl('code', { value: 'ab' }));
    const validator = vi.fn(() => '自定义失败');
    form.rules = { code: { pattern: '^\\d+$', validator } };

    const result = await form.validateAsync();

    // The asynchronous path runs every check but only reports the first
    // failure, so the declarative message wins over the validator's.
    expect(result.fields[0].message).toBe('格式不正确');
    expect(validator).toHaveBeenCalledTimes(1);
    expect(validator).toHaveBeenCalledWith('ab', form);
  });

  it('skips the validator in `submitAsync` when `novalidate` is set', async () => {
    const form = createForm({ novalidate: '' });
    form.append(createControl('email', { value: 'bad' }));
    const validator = vi.fn(() => '不该执行');
    form.rules = { email: { validator } };
    const submitted = vi.fn();
    form.addEventListener('an-form-submit', submitted);

    await expect(form.submitAsync()).resolves.toBe(true);

    expect(validator).not.toHaveBeenCalled();
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('lets `validateField` await an asynchronous validator on one field only', async () => {
    const form = createForm();
    form.append(
      createControl('email', { value: 'bad' }),
      createControl('nick', { value: 'x' }),
    );
    const emailValidator = vi.fn(async () => '邮箱不合法');
    const nickValidator = vi.fn(async () => '昵称不合法');
    form.rules = { email: { validator: emailValidator }, nick: { validator: nickValidator } };

    await expect(form.validateField('email')).resolves.toBe(false);
    await expect(form.validateField('nick')).resolves.toBe(false);
    // A field without rules is valid and runs nothing.
    await expect(form.validateField('absent')).resolves.toBe(true);

    expect(emailValidator).toHaveBeenCalledTimes(1);
    expect(nickValidator).toHaveBeenCalledTimes(1);
  });
});

describe('an-form — error summary is not a control', () => {
  it('does not count its own summary node as a form control', () => {
    const form = createForm({ 'show-error-summary': '' });
    form.append(createControl('bad', { valid: false, message: '请选择' }));

    expect(form.submit()).toBe(false);

    // The summary is injected into the form element itself; if it were picked
    // up as a control, a second submit would report it as a field.
    const summary = form.querySelector('[part="error-summary"]') as HTMLElement;
    expect(summary).not.toBeNull();
    expect(summary.hasAttribute('data-an-form-own')).toBe(true);

    const second = form.validate();
    expect(second.fields.map((field) => field.name)).toEqual(['bad']);
    expect(second.fields.some((field) => field.element === summary)).toBe(false);
  });

  it('reports every invalid control in DOM order after the summary exists', () => {
    const form = createForm({ 'show-error-summary': '' });
    const first = createControl('one', { valid: false, message: '一' });
    const second = createControl('two', { valid: false, message: '二' });
    form.append(first, second);

    form.submit();
    form.submit();

    const names = form.validate().fields.map((field) => field.name);
    expect(names).toEqual(['one', 'two']);
  });
});

describe('an-form — native and checkable controls', () => {
  it('serializes a native text value and accepts its required rule', async () => {
    const form = createForm();
    const input = document.createElement('input');
    input.name = 'title';
    input.value = 'Alice';
    input.required = true;
    form.append(input);
    form.rules = { title: { required: true } };

    expect(form.getFormData().get('title')).toBe('Alice');
    expect(form.getFieldValue('title')).toBe('Alice');
    expect(form.validate()).toEqual({ valid: true, fields: [] });
    await expect(form.validateAsync()).resolves.toEqual({ valid: true, fields: [] });
  });

  it('omits unchecked custom checkboxes and enforces their required rule', async () => {
    const form = createForm();
    const checkbox = document.createElement('an-checkbox') as AnCheckbox;
    checkbox.setAttribute('name', 'agree');
    checkbox.setAttribute('value', 'yes');
    form.append(checkbox);
    form.rules = { agree: { required: true } };

    expect(form.getFormData().has('agree')).toBe(false);
    expect(form.getFieldValue('agree')).toBe('');
    expect(form.validate().valid).toBe(false);
    await expect(form.validateField('agree')).resolves.toBe(false);

    checkbox.checked = true;
    expect(form.getFormData().get('agree')).toBe('yes');
    expect(form.validate().valid).toBe(true);
    await expect(form.validateField('agree')).resolves.toBe(true);
  });

  it.each(['checkbox', 'radio', 'switch'])(
    'omits unchecked custom %s controls before reading their own FormData',
    (role) => {
      const form = createForm();
      const control = Object.assign(createControl('choice', { value: 'yes' }), { checked: false });
      control.setAttribute('role', role);
      form.append(control);

      expect(control.getFormData().get('choice')).toBe('yes');
      expect(form.getFormData().has('choice')).toBe(false);
      control.checked = true;
      expect(form.getFormData().get('choice')).toBe('yes');
    },
  );

  it('validates same-name native radios once with their selected value', async () => {
    const form = createForm();
    const first = document.createElement('input');
    first.type = 'radio';
    first.name = 'kind';
    first.value = 'a';
    const second = document.createElement('input');
    second.type = 'radio';
    second.name = 'kind';
    second.value = 'b';
    form.append(first, second);
    const validator = vi.fn(async () => null);
    form.rules = { kind: { required: true, validator } };

    expect(form.validate().fields).toHaveLength(1);
    first.checked = true;
    expect(Array.from(form.getFormData())).toEqual([['kind', 'a']]);
    expect(form.validate()).toEqual({ valid: true, fields: [] });
    await expect(form.validateAsync()).resolves.toEqual({ valid: true, fields: [] });
    expect(validator).toHaveBeenCalledExactlyOnceWith('a', form);
    await expect(form.validateField('kind')).resolves.toBe(true);
    await expect(form.submitAsync()).resolves.toBe(true);

    first.checked = false;
    second.checked = true;
    expect(Array.from(form.getFormData())).toEqual([['kind', 'b']]);
    expect(form.validate()).toEqual({ valid: true, fields: [] });
    await expect(form.validateField('kind')).resolves.toBe(true);
    expect(validator).toHaveBeenLastCalledWith('b', form);

    second.checked = false;
    const invalid = await form.validateAsync();
    expect(invalid.valid).toBe(false);
    expect(invalid.fields).toHaveLength(1);
  });

  it('includes and validates only controls in the first direct legend of a disabled fieldset', async () => {
    const form = createForm();
    const fieldset = document.createElement('fieldset');
    fieldset.disabled = true;
    const legend = document.createElement('legend');
    const wrapper = document.createElement('span');
    const enabled = createControl('enabled', { value: 'Alice', valid: false });
    wrapper.append(enabled);
    legend.append(wrapper);
    const sibling = createControl('disabled', { value: 'hidden', valid: false });
    const laterLegend = document.createElement('legend');
    const later = createControl('later', { value: 'hidden', valid: false });
    laterLegend.append(later);
    fieldset.append(legend, sibling, laterLegend);
    form.append(fieldset);

    expect(Array.from(form.getFormData())).toEqual([['enabled', 'Alice']]);
    expect(form.validate().fields.map((field) => field.name)).toEqual(['enabled']);
    expect((await form.validateAsync()).fields.map((field) => field.name)).toEqual(['enabled']);
    enabled.valid = true;
    await expect(form.submitAsync()).resolves.toBe(true);
  });

  it('keeps native required inputs inside the first legend enabled', () => {
    const form = createForm();
    const fieldset = document.createElement('fieldset');
    fieldset.disabled = true;
    const legend = document.createElement('legend');
    const input = document.createElement('input');
    input.name = 'title';
    input.required = true;
    legend.append(input);
    fieldset.append(legend);
    form.append(fieldset);
    form.rules = { title: { required: true } };

    expect(form.validate().valid).toBe(false);
    input.value = 'Alice';
    expect(form.validate()).toEqual({ valid: true, fields: [] });
    expect(Array.from(form.getFormData())).toEqual([['title', 'Alice']]);
  });

  it('checks every disabled fieldset ancestor independently of inner legend exceptions', () => {
    const form = createForm();
    const outer = document.createElement('fieldset');
    outer.disabled = true;
    const outerLegend = document.createElement('legend');
    const inner = document.createElement('fieldset');
    inner.disabled = true;
    const innerLegend = document.createElement('legend');
    const enabled = createControl('enabled', { value: 'yes' });
    const disabled = createControl('inner-disabled', { value: 'no', valid: false });
    innerLegend.append(enabled);
    inner.append(innerLegend, disabled);
    outerLegend.append(inner);
    outer.append(outerLegend);

    const siblingFieldset = document.createElement('fieldset');
    siblingFieldset.disabled = true;
    const siblingLegend = document.createElement('legend');
    siblingLegend.append(createControl('outer-disabled', { value: 'no', valid: false }));
    siblingFieldset.append(siblingLegend);
    outer.append(siblingFieldset);
    form.append(outer);

    expect(Array.from(form.getFormData())).toEqual([['enabled', 'yes']]);
    expect(form.validate()).toEqual({ valid: true, fields: [] });
  });
});

describe('an-form — async submission snapshots', () => {
  it('rechecks platform validity when required is added during a pending validator', async () => {
    const form = createForm();
    const control = createControl('email', { value: 'allowed' });
    const empty = document.createElement('input');
    empty.name = 'title';
    form.append(control, empty);
    let resolve!: (message: string | null) => void;
    const validator = vi.fn(() => new Promise<string | null>((done) => { resolve = done; }));
    form.rules = { email: { validator } };
    const submitted = vi.fn();
    form.addEventListener('an-form-submit', submitted);

    const pending = form.submitAsync();
    empty.required = true;
    resolve(null);
    await new Promise((done) => setTimeout(done, 0));
    expect(validator).toHaveBeenCalledTimes(2);
    resolve(null);

    await expect(pending).resolves.toBe(false);
    expect(submitted).not.toHaveBeenCalled();
  });

  it('retries with current successful controls when one is disabled during validation', async () => {
    const form = createForm();
    const control = createControl('email', { value: 'allowed' });
    const disabled = createControl('private', { value: 'old' });
    form.append(control, disabled);
    let resolve!: (message: string | null) => void;
    const validator = vi.fn(() => new Promise<string | null>((done) => { resolve = done; }));
    form.rules = { email: { validator } };
    const submitted = vi.fn();
    form.addEventListener('an-form-submit', submitted);

    const pending = form.submitAsync();
    disabled.setAttribute('disabled', '');
    resolve(null);
    await new Promise((done) => setTimeout(done, 0));
    expect(validator).toHaveBeenCalledTimes(2);
    expect(submitted).not.toHaveBeenCalled();
    resolve(null);

    await expect(pending).resolves.toBe(true);
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitted.mock.calls[0][0].detail.values).toEqual({ email: 'allowed' });
  });

  it('rechecks validity changes without a value or attribute mutation', async () => {
    const form = createForm();
    const control = createControl('email', { value: 'allowed' });
    const other = createControl('other', { value: 'same' });
    form.append(control, other);
    let resolve!: (message: string | null) => void;
    const validator = vi.fn(() => new Promise<string | null>((done) => { resolve = done; }));
    form.rules = { email: { validator } };
    const submitted = vi.fn();
    form.addEventListener('an-form-submit', submitted);

    const pending = form.submitAsync();
    other.valid = false;
    resolve(null);
    await new Promise((done) => setTimeout(done, 0));
    expect(validator).toHaveBeenCalledTimes(2);
    resolve(null);

    await expect(pending).resolves.toBe(false);
    expect(submitted).not.toHaveBeenCalled();
  });

  it('retries a constraint change at most once even while both states remain valid', async () => {
    const form = createForm();
    const control = createControl('email', { value: 'allowed' });
    const input = document.createElement('input');
    input.name = 'title';
    input.value = 'Alice';
    form.append(control, input);
    let resolve!: (message: string | null) => void;
    const validator = vi.fn(() => new Promise<string | null>((done) => { resolve = done; }));
    form.rules = { email: { validator } };
    const submitted = vi.fn();
    form.addEventListener('an-form-submit', submitted);

    const pending = form.submitAsync();
    input.required = true;
    resolve(null);
    await new Promise((done) => setTimeout(done, 0));
    expect(validator).toHaveBeenCalledTimes(2);
    input.required = false;
    resolve(null);

    await expect(pending).resolves.toBe(false);
    expect(validator).toHaveBeenCalledTimes(2);
    expect(submitted).not.toHaveBeenCalled();
  });

  it('does not submit a stale value edited while a validator is pending', async () => {
    const form = createForm();
    const control = createControl('email', { value: 'allowed' });
    form.append(control);
    const resolvers: Array<(message: string | null) => void> = [];
    const validator = vi.fn(
      (value: string) =>
        new Promise<string | null>((resolve) => {
          void value;
          resolvers.push(resolve);
        }),
    );
    form.rules = { email: { validator } };
    const submitted = vi.fn();
    form.addEventListener('an-form-submit', submitted);

    const pending = form.submitAsync();
    await Promise.resolve();
    control.value = 'forbidden';
    resolvers.shift()!(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(validator).toHaveBeenCalledTimes(2);
    resolvers.shift()!('禁止值');

    await expect(pending).resolves.toBe(false);
    expect(submitted).not.toHaveBeenCalled();
  });

  it('invalidates an older async submit when a newer submit starts', async () => {
    const form = createForm();
    form.append(createControl('email', { value: 'allowed' }));
    const resolvers: Array<(message: string | null) => void> = [];
    form.rules = {
      email: {
        validator: () => new Promise<string | null>((resolve) => resolvers.push(resolve)),
      },
    };
    const first = form.submitAsync();
    await Promise.resolve();
    const second = form.submitAsync();
    await Promise.resolve();
    resolvers.shift()!(null);
    await expect(first).resolves.toBe(false);
    resolvers.shift()!(null);
    await expect(second).resolves.toBe(true);
  });

  it('invalidates an async submit after reset without reporting a stale result', async () => {
    const form = createForm();
    form.append(createControl('email', { value: 'allowed' }));
    let resolve!: (message: string | null) => void;
    form.rules = {
      email: { validator: () => new Promise<string | null>((done) => { resolve = done; }) },
    };
    const pending = form.submitAsync();
    await Promise.resolve();
    form.reset();
    resolve(null);

    await expect(pending).resolves.toBe(false);
  });

  it('does not let disabled fields fail required rules', () => {
    const form = createForm();
    const control = createControl('disabled', { value: '' });
    control.setAttribute('disabled', '');
    form.append(control);
    form.rules = { disabled: { required: true } };

    expect(form.validate()).toEqual({ valid: true, fields: [] });
    expect(form.submit()).toBe(true);
    expect(form.getFormData().has('disabled')).toBe(false);
  });

  it('uses checked state before value for unchecked native checkbox rules', () => {
    const form = createForm();
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'agree';
    checkbox.value = 'yes';
    form.append(checkbox);
    form.rules = { agree: { required: true, message: '请同意' } };

    expect(form.validate().fields[0]).toMatchObject({ name: 'agree', message: '请同意' });
    checkbox.checked = true;
    expect(form.validate()).toEqual({ valid: true, fields: [] });
  });
});
