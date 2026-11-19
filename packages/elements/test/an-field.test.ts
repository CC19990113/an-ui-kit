/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AnField } from '../src/field/an-field';
import fieldCssSource from '../src/field/an-field.css?inline';
import { componentSuite } from './helpers/harness';

const CSS_VARS = [
  '--an-field-gap',
  '--an-field-label-font-size',
  '--an-field-hint-color',
  '--an-field-error-color',
];

/*
 * `<an-field>` sits in `src/field/` and `src/index.ts` is owned by another
 * change, so the tag is registered here. The guard keeps the definition single
 * once the barrel entry lands.
 */
if (!customElements.get('an-field')) customElements.define('an-field', AnField);

/**
 * The smallest thing `<an-field>` can wrap: a control that only exposes the
 * validation surface the field reads. No form participation, no shadow DOM —
 * the point is that the field never depends on one particular component.
 */
class FakeControl extends HTMLElement {
  validationMessage = '';
}

if (!customElements.get('fake-control')) customElements.define('fake-control', FakeControl);

function mount(attributes: Record<string, string> = {}, ...children: Element[]): AnField {
  const element = document.createElement('an-field') as AnField;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children);
  document.body.append(element);
  return element;
}

/** Shadow part lookup; re-query after every update, rendering replaces the markup. */
function part(element: AnField, name: string): HTMLElement {
  return element.shadowRoot!.querySelector(`[part~="${name}"]`) as HTMLElement;
}

function isHidden(element: AnField, name: string): boolean {
  return part(element, name).hasAttribute('hidden');
}

function errorText(element: AnField): string {
  return isHidden(element, 'error') ? '' : part(element, 'error').textContent!.trim();
}

/** Reports the control as invalid, the way a native form submission would. */
function fail(control: FakeControl, message = '请输入邮箱'): void {
  control.validationMessage = message;
  control.dispatchEvent(new Event('invalid'));
}

function change(control: Element, type = 'input'): void {
  control.dispatchEvent(new Event(type, { bubbles: true }));
}

componentSuite({
  tag: 'an-field',
  ctor: AnField,
  defaults: AnField.defaults,
  cssVars: CSS_VARS,
  parts: ['base', 'label', 'control', 'hint', 'error'],
});

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('an-field', () => {
  it('renders the documented structure without any markup', () => {
    const element = mount();
    const base = part(element, 'base');
    const control = part(element, 'control');

    expect(base.contains(part(element, 'label'))).toBe(true);
    expect(base.contains(control)).toBe(true);
    expect(control.querySelector('slot')).not.toBeNull();
    expect(isHidden(element, 'label')).toBe(true);
    expect(isHidden(element, 'hint')).toBe(true);
    expect(isHidden(element, 'error')).toBe(true);
    expect(control.hasAttribute('data-invalid')).toBe(false);
    expect(element.shadowRoot!.querySelector('[part="required"]')).toBeNull();
  });

  it('renders label and hint text inside their parts', () => {
    const element = mount({ label: '邮箱', hint: '我们不会公开' });

    expect(part(element, 'label').textContent).toBe('邮箱');
    expect(part(element, 'hint').textContent).toBe('我们不会公开');
    expect(isHidden(element, 'label')).toBe(false);
    expect(isHidden(element, 'hint')).toBe(false);
  });

  it('appends a marked required star only when `required` is set', () => {
    const element = mount({ label: '邮箱', required: '' });
    const star = element.shadowRoot!.querySelector('[part="required"]')!;

    expect(part(element, 'label').textContent).toBe('邮箱*');
    expect(star.textContent).toBe('*');
    expect(star.getAttribute('aria-hidden')).toBe('true');

    element.removeAttribute('required');
    expect(element.shadowRoot!.querySelector('[part="required"]')).toBeNull();
    expect(part(element, 'label').textContent).toBe('邮箱');
  });

  it('hides the label when no label text is set', () => {
    const element = mount({ hint: '只有提示' });

    expect(isHidden(element, 'label')).toBe(true);
    expect(part(element, 'label').textContent).toBe('');
  });

  it('escapes label, hint and error text', () => {
    const element = mount({ label: '<em>label</em>', hint: 'a & b', error: '<b>bad</b>' });

    expect(element.shadowRoot!.querySelector('em')).toBeNull();
    expect(element.shadowRoot!.querySelector('b')).toBeNull();
    expect(part(element, 'label').textContent).toBe('<em>label</em>');
    expect(part(element, 'hint').textContent).toBe('a & b');
    expect(errorText(element)).toBe('<b>bad</b>');
  });

  it('announces the error through a role="alert" paragraph', () => {
    const element = mount({ error: '邮箱已被占用' });
    const error = part(element, 'error');

    expect(error.getAttribute('role')).toBe('alert');
    expect(errorText(element)).toBe('邮箱已被占用');
  });

  it('captures the invalid event of a slotted control in the capture phase', () => {
    const control = new FakeControl();
    const element = mount({ label: '邮箱' }, control);

    expect(isHidden(element, 'error')).toBe(true);
    fail(control, '请输入有效的邮箱地址');

    expect(errorText(element)).toBe('请输入有效的邮箱地址');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(part(element, 'control').hasAttribute('data-invalid')).toBe(true);
  });

  it('falls back to a Chinese message when the control has none', () => {
    const control = new FakeControl();
    const element = mount({ label: '邮箱' }, control);

    fail(control, '');

    expect(errorText(element)).toBe('请输入有效值');
  });

  it('lets the `error` attribute override the captured message', () => {
    const control = new FakeControl();
    const element = mount({ label: '邮箱' }, control);

    fail(control, '平台消息');
    element.setAttribute('error', '外部消息');

    expect(errorText(element)).toBe('外部消息');

    element.removeAttribute('error');
    expect(errorText(element)).toBe('平台消息');
  });

  it('clears the captured error when the control value changes', () => {
    const control = new FakeControl();
    const element = mount({ label: '邮箱' }, control);

    fail(control);
    expect(isHidden(element, 'error')).toBe(false);

    change(control);

    expect(isHidden(element, 'error')).toBe(true);
    expect(control.getAttribute('aria-invalid')).toBeNull();
    expect(part(element, 'control').hasAttribute('data-invalid')).toBe(false);
  });

  it.each(['an-input', 'an-change', 'an-checkbox-change', 'an-switch-change', 'an-radio-change', 'an-select-change', 'an-textarea-change'])(
    'clears the captured error on the %s event as well',
    (type) => {
      const control = new FakeControl();
      const element = mount({ label: '选项' }, control);

      fail(control);
      change(control, type);

      expect(isHidden(element, 'error')).toBe(true);
    },
  );

  it('keeps an explicit `error` attribute when the value changes', () => {
    const control = new FakeControl();
    const element = mount({ label: '邮箱', error: '外部消息' }, control);

    change(control);

    expect(errorText(element)).toBe('外部消息');
  });

  it('links the slotted control to the label by id and by text', () => {
    const control = new FakeControl();
    const element = mount({ label: '邮箱' }, control);
    const label = part(element, 'label');

    expect(label.id).not.toBe('');
    expect(control.getAttribute('aria-labelledby')).toBe(label.id);
    // IDREFs cannot cross a shadow boundary; `aria-label` keeps the control
    // named where that resolution is not honoured.
    expect(control.getAttribute('aria-label')).toBe('邮箱');
  });

  it('keeps the label id stable across re-renders', () => {
    const control = new FakeControl();
    const element = mount({ label: '邮箱' }, control);
    const id = part(element, 'label').id;

    element.setAttribute('error', 'boom');

    expect(part(element, 'label').id).toBe(id);
    expect(control.getAttribute('aria-labelledby')).toBe(id);
  });

  it('describes the control with the hint and the shown error only', () => {
    const control = new FakeControl();
    const element = mount({ label: '邮箱', hint: '我们不会公开' }, control);

    expect(control.getAttribute('aria-describedby')).toBe(part(element, 'hint').id);
    expect(control.getAttribute('aria-description')).toBe('我们不会公开');

    fail(control, '请输入邮箱');

    const ids = control.getAttribute('aria-describedby')!.split(' ');
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(part(element, 'hint').id);
    expect(ids[1]).toBe(part(element, 'error').id);
    expect(control.getAttribute('aria-description')).toBe('我们不会公开 请输入邮箱');
  });

  it('drops the described-by link when neither hint nor error shows', () => {
    const control = new FakeControl();
    mount({ label: '邮箱' }, control);

    expect(control.hasAttribute('aria-describedby')).toBe(false);
    expect(control.hasAttribute('aria-description')).toBe(false);
  });

  it('passes `required` to the control as aria-required without validating it', () => {
    const control = new FakeControl();
    const element = mount({ label: '邮箱', required: '' }, control);

    expect(control.getAttribute('aria-required')).toBe('true');

    element.removeAttribute('required');
    expect(control.hasAttribute('aria-required')).toBe(false);
  });

  it('does not name a control that already names itself', () => {
    const control = new FakeControl();
    control.setAttribute('label', '自带的 label');
    mount({ label: '字段 label' }, control);

    expect(control.getAttribute('label')).toBe('自带的 label');
    expect(control.hasAttribute('aria-label')).toBe(false);
    expect(control.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('respects an author-provided aria-label', () => {
    const control = new FakeControl();
    control.setAttribute('aria-label', '外部名称');
    mount({ label: '字段 label' }, control);

    expect(control.getAttribute('aria-label')).toBe('外部名称');
    expect(control.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('removes the links it wrote when the label is cleared', () => {
    const control = new FakeControl();
    const element = mount({ label: '邮箱' }, control);

    element.removeAttribute('label');

    expect(control.hasAttribute('aria-label')).toBe(false);
    expect(control.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('links every direct child, not just the first one', () => {
    const first = new FakeControl();
    const second = new FakeControl();
    const element = mount({ label: '邮箱' }, first, second);

    for (const control of [first, second]) {
      expect(control.getAttribute('aria-label')).toBe('邮箱');
      expect(control.getAttribute('aria-labelledby')).toBe(part(element, 'label').id);
    }
  });

  it('marks only the control that reported itself invalid', () => {
    const first = new FakeControl();
    const second = new FakeControl();
    const element = mount({ label: '邮箱' }, first, second);

    fail(second, '第二项无效');

    expect(first.hasAttribute('aria-invalid')).toBe(false);
    expect(second.getAttribute('aria-invalid')).toBe('true');
    expect(errorText(element)).toBe('第二项无效');
  });

  it('links a control that is added after the first render', async () => {
    const element = mount({ label: '邮箱' });
    const control = new FakeControl();

    element.append(control);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(control.getAttribute('aria-label')).toBe('邮箱');
    expect(control.getAttribute('aria-labelledby')).toBe(part(element, 'label').id);
  });

  it('moves aria-invalid when another control reports the same message', () => {
    const first = new FakeControl();
    const second = new FakeControl();
    const element = mount({ label: '邮箱' }, first, second);

    fail(first, '请输入有效值');
    expect(first.getAttribute('aria-invalid')).toBe('true');

    fail(second, '请输入有效值');

    expect(first.hasAttribute('aria-invalid')).toBe(false);
    expect(second.getAttribute('aria-invalid')).toBe('true');
    expect(errorText(element)).toBe('请输入有效值');
  });

  it('ignores events that belong to a nested field', () => {
    const innerControl = new FakeControl();
    const inner = mount({ label: '内层' }, innerControl);
    const outer = mount({ label: '外层' });

    inner.remove();
    outer.append(inner);

    fail(innerControl, '内层错误');

    expect(isHidden(outer, 'error')).toBe(true);
    expect(errorText(inner)).toBe('内层错误');

    change(innerControl);
    expect(isHidden(outer, 'error')).toBe(true);
    expect(innerControl.getAttribute('aria-labelledby')).toBe(part(inner, 'label').id);
  });

  it('keeps the slotted control across re-renders', () => {
    const control = new FakeControl();
    const element = mount({ label: '邮箱' }, control);

    element.setAttribute('error', 'boom');
    element.setAttribute('hint', '提示');

    expect(element.children).toHaveLength(1);
    expect(element.firstElementChild).toBe(control);
    expect(control.isConnected).toBe(true);
  });

  it('is not form-associated and never contributes a form value', () => {
    const form = document.createElement('form');
    const field = document.createElement('an-field');
    field.setAttribute('label', '邮箱');
    field.setAttribute('name', 'wrapper');
    field.setAttribute('value', 'nope');

    const input = document.createElement('input');
    input.name = 'email';
    input.value = 'a@b.c';
    field.append(input);
    form.append(field);
    document.body.append(form);

    const data = new FormData(form);
    expect([...data.keys()]).toEqual(['email']);
    expect(data.get('email')).toBe('a@b.c');
    expect(Array.from(form.elements)).not.toContain(field);
  });

  it('ships the stylesheet hooks the contract documents', () => {
    for (const property of CSS_VARS) expect(fieldCssSource).toContain(property);
    expect(fieldCssSource).toContain('--an-color-danger-9');
    expect(fieldCssSource).toContain('--an-color-fg-1');
    // The empty label is `display: inline-flex`, so `[hidden]` has to win here.
    expect(fieldCssSource).toContain('[hidden]');
  });
});
