/** @vitest-environment happy-dom */
// The internals shim must be installed before the element is constructed, so its
// `attachInternals()` call finds it: static imports are evaluated in source order.
import './helpers/form-internals';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AnCheckbox } from '../src/checkbox/an-checkbox';
import checkboxCssSource from '../src/checkbox/an-checkbox.css?inline';
import { internalsState } from './helpers/form-internals';
import { componentSuite } from './helpers/harness';

// The component is not part of `src/index.ts` yet, so the test registers it here.
if (!customElements.get('an-checkbox')) customElements.define('an-checkbox', AnCheckbox);

const CSS_VARS = [
  '--an-checkbox-size',
  '--an-checkbox-radius',
  '--an-checkbox-accent',
  '--an-checkbox-border-color',
];

const REQUIRED_MESSAGE = '此字段为必填项。';

componentSuite({
  tag: 'an-checkbox',
  ctor: AnCheckbox,
  defaults: AnCheckbox.defaults,
  events: ['an-checkbox-change'],
  cssVars: CSS_VARS,
  parts: ['base', 'control', 'label'],
});

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(attributes: Record<string, string> = {}): AnCheckbox {
  const element = document.createElement('an-checkbox') as AnCheckbox;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
}

function inner(element: AnCheckbox): HTMLInputElement {
  return element.shadowRoot!.querySelector('input')!;
}

/**
 * Clicks the painted box the way a pointer would: the target is the decorative
 * sibling, not the native input, so this exercises the forwarding path.
 */
function click(element: AnCheckbox, part = 'control'): void {
  const target = element.shadowRoot!.querySelector(`[part="${part}"]`)??
    element.shadowRoot!.querySelector('label')!;
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
}

describe('an-checkbox', () => {
  it('renders a native checkbox inside a label, with the box and the slot', () => {
    const element = mount();
    const base = element.shadowRoot!.querySelector('[part="base"]')!;
    const control = element.shadowRoot!.querySelector('[part="control"]')!;
    const label = element.shadowRoot!.querySelector('[part="label"]')!;
    const input = inner(element);

    expect(base.tagName).toBe('LABEL');
    expect(base.classList.contains('base')).toBe(true);
    expect(input.type).toBe('checkbox');
    expect(input.getAttribute('part')).toBeNull();
    expect(base.contains(input)).toBe(true);
    expect(base.contains(control)).toBe(true);
    expect(label.querySelector('slot')).not.toBeNull();
    expect(element.shadowRoot!.querySelectorAll('input')).toHaveLength(1);
  });

  it('renders slot text as the visible label without interpreting it', () => {
    const element = mount();
    element.textContent = '<b>Remember</b>';
    const label = element.shadowRoot!.querySelector('[part="label"]')!;
    const slot = label.querySelector('slot') as HTMLSlotElement;

    expect(slot.assignedNodes().map((node) => node.textContent).join('')).toBe('<b>Remember</b>');
    expect(label.querySelector('b')).toBeNull();

    document.body.innerHTML = '<an-checkbox>记住我</an-checkbox>';
    const parsed = document.body.firstElementChild as AnCheckbox;
    const parsedSlot = parsed.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    expect(parsedSlot.assignedNodes().map((node) => node.textContent).join('')).toBe('记住我');
  });

  it('reflects checked between the attribute, the property and the inner input', () => {
    const element = mount();
    expect(element.checked).toBe(false);
    expect(element.hasAttribute('checked')).toBe(false);
    expect(inner(element).checked).toBe(false);

    element.setAttribute('checked', '');
    expect(element.checked).toBe(true);
    expect(inner(element).checked).toBe(true);

    element.checked = false;
    expect(element.hasAttribute('checked')).toBe(false);
    expect(inner(element).checked).toBe(false);

    element.checked = true;
    expect(element.hasAttribute('checked')).toBe(true);
    expect(inner(element).checked).toBe(true);
  });

  it('keeps name and value in sync with their attributes and escapes them', () => {
    const element = mount();
    expect(element.value).toBe('on');
    expect(element.hasAttribute('value')).toBe(false);

    element.setAttribute('value', 'a"b<c');
    expect(element.value).toBe('a"b<c');
    expect(inner(element).getAttribute('value')).toBe('a"b<c');

    element.value = 'custom';
    expect(element.getAttribute('value')).toBe('custom');
    expect(inner(element).getAttribute('value')).toBe('custom');

    element.setAttribute('name', 'n&m');
    expect(element.name).toBe('n&m');
    expect(inner(element).getAttribute('name')).toBe('n&m');

    element.name = 'remember';
    expect(element.getAttribute('name')).toBe('remember');
    expect(inner(element).getAttribute('name')).toBe('remember');
    expect(element.shadowRoot!.querySelectorAll('input')).toHaveLength(1);
  });

  it('toggles exactly once per click and reports a bubbling, composed event', () => {
    const element = mount({ name: 'remember', value: 'yes' });
    const seen: CustomEvent[] = [];
    const listener = (event: Event): void => {
      seen.push(event as CustomEvent);
    };
    document.addEventListener('an-checkbox-change', listener);

    try {
      click(element);
      expect(element.checked).toBe(true);
      expect(element.hasAttribute('checked')).toBe(true);
      expect(inner(element).checked).toBe(true);
      expect(seen).toHaveLength(1);
      expect(seen[0].bubbles).toBe(true);
      expect(seen[0].composed).toBe(true);
      expect(seen[0].detail.checked).toBe(true);
      expect(seen[0].detail.value).toBe('yes');
      expect(seen[0].detail.originalEvent).toBeInstanceOf(Event);
      expect((seen[0].detail.originalEvent as Event).type).toBe('change');

      click(element);
      expect(element.checked).toBe(false);
      expect(element.hasAttribute('checked')).toBe(false);
      expect(seen).toHaveLength(2);
      expect(seen[1].detail.checked).toBe(false);
    } finally {
      document.removeEventListener('an-checkbox-change', listener);
    }
  });

  it('toggles once when the click lands on the label instead of the box', () => {
    const element = mount();
    const seen: Event[] = [];
    element.addEventListener('an-checkbox-change', (event) => seen.push(event));

    click(element, 'label');
    expect(element.checked).toBe(true);
    expect(seen).toHaveLength(1);
    // Like a native label click, focus lands on the control and survives the re-render.
    expect(element.shadowRoot!.activeElement).toBe(inner(element));
  });

  it('leaves clicks on the native input to the platform instead of double toggling', () => {
    const element = mount();
    const seen: Event[] = [];
    element.addEventListener('an-checkbox-change', (event) => seen.push(event));

    inner(element).click();
    expect(element.checked).toBe(true);
    expect(element.hasAttribute('checked')).toBe(true);
    expect(seen).toHaveLength(1);
  });

  it('blocks toggling and events while disabled', () => {
    const element = mount({ disabled: '' });
    const seen: Event[] = [];
    element.addEventListener('an-checkbox-change', (event) => seen.push(event));

    expect(inner(element).disabled).toBe(true);
    click(element);
    click(element, 'label');
    inner(element).click();
    expect(element.checked).toBe(false);
    expect(seen).toHaveLength(0);

    element.disabled = false;
    expect(inner(element).disabled).toBe(false);
    click(element);
    expect(element.checked).toBe(true);
    expect(seen).toHaveLength(1);
  });

  it('maps indeterminate onto the native input and aria-checked="mixed"', () => {
    const element = mount();
    expect(inner(element).indeterminate).toBe(false);
    expect(inner(element).getAttribute('aria-checked')).toBeNull();

    element.setAttribute('indeterminate', '');
    expect(element.indeterminate).toBe(true);
    expect(inner(element).indeterminate).toBe(true);
    expect(inner(element).getAttribute('aria-checked')).toBe('mixed');
    expect(inner(element).hasAttribute('checked')).toBe(false);

    element.indeterminate = false;
    expect(element.hasAttribute('indeterminate')).toBe(false);
    expect(inner(element).indeterminate).toBe(false);
    expect(inner(element).getAttribute('aria-checked')).toBeNull();
  });

  describe('form semantics', () => {
    it('returns direct form data only while checked and named', () => {
      const element = mount({ name: 'remember', value: 'yes' });

      expect(element.getFormData()).toBeNull();

      element.checked = true;
      expect(Array.from(element.getFormData()!.entries())).toEqual([['remember', 'yes']]);

      element.checked = false;
      expect(element.getFormData()).toBeNull();

      element.checked = true;
      element.value = '';
      expect(Array.from(element.getFormData()!.entries())).toEqual([['remember', '']]);

      element.name = '';
      expect(element.getFormData()).toBeNull();
    });

    it('omits direct form data while disabled by the host or fieldset', () => {
      const element = mount({ name: 'remember', checked: '' });

      element.disabled = true;
      expect(element.getFormData()).toBeNull();

      element.disabled = false;
      expect(Array.from(element.getFormData()!.entries())).toEqual([['remember', 'on']]);

      element.formDisabledCallback(true);
      expect(element.getFormData()).toBeNull();

      element.formDisabledCallback(false);
      expect(Array.from(element.getFormData()!.entries())).toEqual([['remember', 'on']]);
    });

    it('submits the value only while checked', () => {
      document.body.innerHTML =
        '<form><an-checkbox name="remember" value="yes"></an-checkbox></form>';
      const form = document.querySelector('form')!;
      const element = document.querySelector('an-checkbox') as AnCheckbox;
      const submits: Event[] = [];
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submits.push(event);
      });

      expect(new FormData(form).has('remember')).toBe(false);
      form.requestSubmit();
      expect(submits).toHaveLength(1);

      click(element);
      expect(new FormData(form).get('remember')).toBe('yes');
      form.requestSubmit();
      expect(submits).toHaveLength(2);
    });

    it('blocks requestSubmit while required and unchecked', () => {
      document.body.innerHTML = '<form><an-checkbox name="remember" required></an-checkbox></form>';
      const form = document.querySelector('form')!;
      const element = document.querySelector('an-checkbox') as AnCheckbox;
      const submits: Event[] = [];
      const invalids: Event[] = [];
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submits.push(event);
      });
      element.addEventListener('invalid', (event) => invalids.push(event));

      const state = internalsState(element)!;
      expect(state.value).toBeNull();
      expect(state.flags).toEqual({ valueMissing: true });
      expect(state.message).toBe(REQUIRED_MESSAGE);
      expect(state.anchor).toBe(inner(element));

      form.requestSubmit();
      expect(submits).toHaveLength(0);
      expect(invalids).toHaveLength(1);

      click(element);
      expect(internalsState(element)!.flags).toEqual({});
      expect(new FormData(form).get('remember')).toBe('on');
      form.requestSubmit();
      expect(submits).toHaveLength(1);
    });

    it('restores the mount-time checked state on form reset', () => {
      document.body.innerHTML = '<form><an-checkbox name="remember" checked></an-checkbox></form>';
      const form = document.querySelector('form')!;
      const element = document.querySelector('an-checkbox') as AnCheckbox;
      expect(element.checked).toBe(true);

      click(element);
      expect(element.checked).toBe(false);
      expect(new FormData(form).has('remember')).toBe(false);

      form.reset();
      expect(element.checked).toBe(true);
      expect(element.hasAttribute('checked')).toBe(true);
      expect(inner(element).checked).toBe(true);
      expect(new FormData(form).get('remember')).toBe('on');

      form.reset();
      expect(element.checked).toBe(true);
    });

    it('resets an unchecked box back to unchecked', () => {
      document.body.innerHTML = '<form><an-checkbox name="remember"></an-checkbox></form>';
      const form = document.querySelector('form')!;
      const element = document.querySelector('an-checkbox') as AnCheckbox;

      click(element);
      expect(element.checked).toBe(true);

      form.reset();
      expect(element.checked).toBe(false);
      expect(element.hasAttribute('checked')).toBe(false);
      expect(new FormData(form).has('remember')).toBe(false);
    });

    it('passes an ancestor fieldset disabled state through', () => {
      document.body.innerHTML = '<form><an-checkbox name="remember" required></an-checkbox></form>';
      const form = document.querySelector('form')!;
      const element = document.querySelector('an-checkbox') as AnCheckbox;
      const submits: Event[] = [];
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submits.push(event);
      });

      // The platform reports the ancestor `<fieldset disabled>` this way.
      element.formDisabledCallback(true);
      expect(inner(element).disabled).toBe(true);
      expect(element.hasAttribute('data-form-disabled')).toBe(true);
      expect(internalsState(element)!.flags).toEqual({});
      expect(internalsState(element)!.value).toBeNull();

      const seen: Event[] = [];
      element.addEventListener('an-checkbox-change', (event) => seen.push(event));
      click(element);
      expect(element.checked).toBe(false);
      expect(seen).toHaveLength(0);

      // Barred from constraint validation while disabled.
      form.requestSubmit();
      expect(submits).toHaveLength(1);

      // Re-enabling brings the constraint back.
      element.formDisabledCallback(false);
      expect(inner(element).disabled).toBe(false);
      expect(element.hasAttribute('data-form-disabled')).toBe(false);
      expect(internalsState(element)!.flags).toEqual({ valueMissing: true });
      form.requestSubmit();
      expect(submits).toHaveLength(1);
    });

    it('keeps a host-level disabled in place when the fieldset state changes', () => {
      const element = mount({ disabled: '' });
      element.formDisabledCallback(true);
      element.formDisabledCallback(false);
      expect(inner(element).disabled).toBe(true);
      expect(internalsState(element)!.flags).toEqual({});
    });
  });

  it('keeps the hook, colour and theme contract in an-checkbox.css', () => {
    for (const hook of CSS_VARS) expect(checkboxCssSource, hook).toContain(`var(${hook}`);
    expect(checkboxCssSource).toContain('--an-color-accent-9');
    expect(checkboxCssSource).toContain('--an-color-border-1');
    expect(checkboxCssSource).toContain('--an-color-fg-1');
    expect(checkboxCssSource).toContain('--an-color-bg-1');
    expect(checkboxCssSource).toContain('--an-radius-sm');
    expect(checkboxCssSource).toContain('--an-space-2');
    expect(checkboxCssSource).toContain("[data-theme='dark']");
    expect(checkboxCssSource).toContain("[data-theme='light']");
    expect(checkboxCssSource).toContain('prefers-reduced-motion');
    expect(AnCheckbox.styles).toBe(checkboxCssSource);
  });

  it('does not leak a native form entry from the inner input', () => {
    document.body.innerHTML = '<form><an-checkbox name="remember"></an-checkbox></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-checkbox') as AnCheckbox;
    // The shadow input has a name, but it is not a member of the outer form.
    expect(inner(element).form).toBeNull();
    expect((form.elements as unknown as ArrayLike<Element>).length).toBe(0);
  });
});
