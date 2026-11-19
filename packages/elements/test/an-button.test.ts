/** @vitest-environment happy-dom */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import '../src/index';
import { AnButton } from '../src/button/an-button';
import buttonCssSource from '../src/button/an-button.css?inline';
import { componentSuite } from './helpers/harness';

function mount(attributes: Record<string, string> = {}, label = 'Save'): AnButton {
  const element = document.createElement('an-button') as AnButton;
  element.textContent = label;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
}

function inner(element: AnButton): HTMLButtonElement {
  const button = element.shadowRoot?.querySelector('button');
  if (!button) throw new Error('an-button did not render its internal <button>');
  return button as HTMLButtonElement;
}

function click(element: AnButton): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
  inner(element).dispatchEvent(event);
  return event;
}

// Registration, defaults, attribute/property reflection, the `base` part, the
// CSS custom properties and `an-button-click`'s bubbles+composed wiring are
// covered once, here, instead of in every component test file.
componentSuite({
  tag: 'an-button',
  ctor: AnButton,
  defaults: AnButton.defaults,
  events: ['an-button-click'],
  cssVars: ['--an-button-height', '--an-button-radius', '--an-button-font-size'],
  parts: ['base'],
});

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('an-button', () => {
  it('renders a real native <button part="base" class="base"> in the shadow root', () => {
    const element = mount();
    const button = inner(element);

    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('part')).toBe('base');
    expect(button.classList.contains('base')).toBe(true);
    expect(element.shadowRoot!.querySelectorAll('button')).toHaveLength(1);
    expect(element.shadowRoot!.querySelector('.base')).toBe(button);
  });

  it('applies the variant and size rules through the real cascade', () => {
    const primary = mount({ variant: 'primary' });
    const plain = mount();
    const large = mount({ size: 'lg' });

    const primaryBackground = getComputedStyle(inner(primary)).backgroundColor;
    const plainBackground = getComputedStyle(inner(plain)).backgroundColor;
    const largeHeight = parseFloat(getComputedStyle(inner(large)).height);
    const plainHeight = parseFloat(getComputedStyle(inner(plain)).height);

    expect(primaryBackground).not.toBe(plainBackground);
    // --an-color-accent-9 fallback must actually reach the element
    expect(primaryBackground.toLowerCase()).toContain('2563eb');
    expect(largeHeight).toBeGreaterThan(plainHeight);
  });

  it('matches every .base rule against the rendered element and its host guards', () => {
    const cases = [
      mount({ variant: 'primary' }),
      mount({ variant: 'danger' }),
      mount({ variant: 'ghost' }),
      mount({ size: 'sm' }),
      mount({ size: 'lg' }),
      mount({ loading: '' }),
    ];
    const button = inner(cases[0]);
    const rules = [...buttonCssSource.matchAll(/([^{}]+)\{/g)].map((match) => match[1].trim());
    const baseRules = rules.filter((selector) => selector.includes('.base'));

    expect(baseRules.length).toBeGreaterThan(0);
    for (const selector of baseRules) {
      // the compound the rule styles must be the rendered element itself
      const target = selector.split(/[\s>+~]+/).pop()!;
      expect(target.startsWith('.base')).toBe(true);

      // state pseudo-classes / state attributes cannot be matched statically
      const stateless = target
        .replace(/:(hover|focus-visible|disabled|not\([^)]*\))/g, '')
        .replace(/\[[^\]]*\]/g, '');
      expect(button.matches(stateless)).toBe(true);

      // every `:host([attr='value'])` guard must be covered by a mounted case
      const guard = /:host\(\[([\w-]+)=['"]([^'"]+)['"]\]\)/.exec(selector);
      if (guard) {
        const [, attr, value] = guard;
        expect(cases.some((element) => element.getAttribute(attr) === value)).toBe(true);
      }
    }
  });

  it('forwards a valid type to the internal button and falls back to button', () => {
    const element = mount();
    expect(inner(element).type).toBe('button');

    element.type = 'submit';
    expect(element.getAttribute('type')).toBe('submit');
    expect(inner(element).type).toBe('submit');

    element.type = 'reset';
    expect(inner(element).type).toBe('reset');

    element.setAttribute('type', 'bogus');
    expect(inner(element).type).toBe('button');
  });

  it('upgrades attributes that were present in markup', () => {
    document.body.innerHTML = '<an-button variant="danger" loading>Delete</an-button>';
    const element = document.body.firstElementChild as AnButton;
    expect(element.variant).toBe('danger');
    expect(element.loading).toBe(true);
    expect(inner(element).disabled).toBe(true);
    expect(inner(element).getAttribute('aria-busy')).toBe('true');
  });

  it('blocks clicks while disabled and allows them again once enabled', () => {
    const element = mount();
    const events: Event[] = [];
    document.addEventListener('an-button-click', (event) => events.push(event));

    const enabledClick = click(element);
    expect(enabledClick.defaultPrevented).toBe(false);
    expect(events).toHaveLength(1);

    element.disabled = true;
    expect(inner(element).disabled).toBe(true);
    // happy-dom, like browsers, swallows clicks aimed at a disabled <button>;
    // dispatch on the shadow root to exercise the guard itself (real click path).
    const blocked = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
    element.shadowRoot!.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);
    click(element);
    expect(events).toHaveLength(1);

    element.disabled = false;
    expect(inner(element).disabled).toBe(false);
    click(element);
    expect(events).toHaveLength(2);
  });

  it('blocks clicks while loading and marks the internal button busy', () => {
    const element = mount({ loading: '' });
    const events: Event[] = [];
    document.addEventListener('an-button-click', (event) => events.push(event));

    expect(inner(element).disabled).toBe(true);
    expect(inner(element).getAttribute('aria-busy')).toBe('true');
    click(element);
    expect(events).toHaveLength(0);

    element.loading = false;
    expect(inner(element).disabled).toBe(false);
    expect(inner(element).hasAttribute('aria-busy')).toBe(false);
    click(element);
    expect(events).toHaveLength(1);
  });

  it('emits a bubbling, composed an-button-click carrying the original event', () => {
    const element = mount();
    const events: CustomEvent[] = [];
    document.addEventListener('an-button-click', (event) => events.push(event as CustomEvent));

    const original = click(element);

    expect(events).toHaveLength(1);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
    expect(events[0].detail.originalEvent).toBe(original);
  });

  it('submits the owning form through requestSubmit() when type="submit" is clicked', () => {
    document.body.innerHTML = '<form><an-button type="submit">Send</an-button></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-button') as AnButton;
    const requestSubmit = vi.spyOn(form, 'requestSubmit');
    const submit = vi.spyOn(form, 'submit');
    const submits: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });

    click(element);

    expect(requestSubmit).toHaveBeenCalledTimes(1);
    expect(submits).toHaveLength(1);
    // form.submit() bypasses constraint validation; it must never be used.
    expect(submit).not.toHaveBeenCalled();
  });

  it('resets the owning form when type="reset" is clicked', () => {
    document.body.innerHTML = '<form><input value="initial"><an-button type="reset">Reset</an-button></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-button') as AnButton;
    const reset = vi.spyOn(form, 'reset');

    click(element);

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('never submits while disabled or loading', () => {
    for (const state of ['disabled', 'loading']) {
      document.body.innerHTML = `<form><an-button type="submit" ${state}>Send</an-button></form>`;
      const form = document.querySelector('form')!;
      const element = document.querySelector('an-button') as AnButton;
      let submits = 0;
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submits += 1;
      });

      click(element);

      expect(submits, state).toBe(0);
    }
  });

  it('renders the label through the default slot', () => {
    const element = mount({}, 'Pay now');
    expect(element.shadowRoot!.querySelector('slot')).not.toBeNull();
    expect(element.textContent).toBe('Pay now');
  });

  it('keeps the colour and custom-property contract in an-button.css', () => {
    const source = buttonCssSource;
    for (const token of [
      '--an-color-accent-9',
      '--an-color-danger-9',
      '--an-color-fg-1',
      '--an-color-bg-1',
      '--an-color-border-1',
      '--an-button-height',
      '--an-button-radius',
      '--an-button-font-size',
    ]) {
      expect(source).toContain(token);
    }
    // every colour token must carry a fallback, because @an-ui-kit/tokens may not be loaded
    expect(source).toMatch(/var\(--an-color-accent-9,\s*#/);
    expect(source).toMatch(/var\(--an-color-danger-9,\s*#/);
    expect(source).toMatch(/var\(--an-color-fg-1,\s*#/);
    expect(source).toMatch(/var\(--an-color-bg-1,\s*#/);
    expect(source).toMatch(/var\(--an-color-border-1,\s*#/);
    // CONTRACT §6: both theme entry points reach the component through tokens,
    // while `color-scheme` keeps native chrome in step with them.
    expect(source).toContain('color-scheme: light dark');
    expect(source).toContain(":host([data-theme='dark'])");
    expect(source).toContain(":host([data-theme='light'])");
  });
});
