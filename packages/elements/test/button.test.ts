/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import '../src/index';
import { XButton } from '../src/button/x-button';
import buttonCssSource from '../src/button/x-button.css?inline';
import resetCssSource from '../src/internal/reset.css?inline';

function mount(attributes: Record<string, string> = {}, label = 'Save'): XButton {
  const element = document.createElement('x-button') as XButton;
  element.textContent = label;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
}

function inner(element: XButton): HTMLButtonElement {
  const button = element.shadowRoot?.querySelector('button');
  if (!button) throw new Error('x-button did not render its internal <button>');
  return button as HTMLButtonElement;
}

function click(element: XButton): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
  inner(element).dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('x-button', () => {
  it('is defined exactly once and upgrades created elements', () => {
    expect(customElements.get('x-button')).toBe(XButton);
    expect(mount()).toBeInstanceOf(XButton);
  });

  it('renders a real native <button part="base"> in the shadow root', () => {
    const element = mount();
    const button = inner(element);
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('part')).toBe('base');
    expect(element.shadowRoot!.querySelectorAll('button')).toHaveLength(1);
  });

  it('gives the internal button the .base class the stylesheet targets', () => {
    const element = mount({ variant: 'primary' });
    const button = inner(element);

    expect(button.classList.contains('base')).toBe(true);
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
    // --x-color-accent-9 fallback must actually reach the element
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

  it('exposes the documented defaults', () => {
    const element = mount();
    expect(element.variant).toBe('default');
    expect(element.size).toBe('md');
    expect(element.disabled).toBe(false);
    expect(element.loading).toBe(false);
    expect(element.type).toBe('button');
    expect(inner(element).type).toBe('button');
  });

  it('syncs attributes into camelCase properties', () => {
    const element = mount();
    element.setAttribute('variant', 'primary');
    expect(element.variant).toBe('primary');
    element.setAttribute('size', 'lg');
    expect(element.size).toBe('lg');
    element.setAttribute('disabled', '');
    expect(element.disabled).toBe(true);
    expect(inner(element).disabled).toBe(true);
    element.removeAttribute('disabled');
    expect(element.disabled).toBe(false);
    expect(inner(element).disabled).toBe(false);
  });

  it('reflects properties back to attributes and re-renders', () => {
    const element = mount();
    element.size = 'sm';
    expect(element.getAttribute('size')).toBe('sm');
    element.variant = 'danger';
    expect(element.getAttribute('variant')).toBe('danger');
    element.type = 'submit';
    expect(element.getAttribute('type')).toBe('submit');
    expect(inner(element).type).toBe('submit');
  });

  it('upgrades attributes that were present in markup', () => {
    document.body.innerHTML = '<x-button variant="danger" loading>Delete</x-button>';
    const element = document.body.firstElementChild as XButton;
    expect(element.variant).toBe('danger');
    expect(element.loading).toBe(true);
    expect(inner(element).disabled).toBe(true);
    expect(inner(element).getAttribute('aria-busy')).toBe('true');
  });

  it('emits a bubbling, composed x-button-click carrying the original event', () => {
    const element = mount();
    const events: CustomEvent[] = [];
    document.addEventListener('x-button-click', (event) => events.push(event as CustomEvent));

    const original = click(element);

    expect(events).toHaveLength(1);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
    expect((events[0].detail as { originalEvent: MouseEvent }).originalEvent).toBe(original);
  });

  // A disabled <button> swallows clicks before they reach any listener (happy-dom
  // models that too), so the guard itself is exercised by dispatching straight on
  // the shadow root — the same code path a real click would take.
  it('blocks clicks with preventDefault and no event while disabled', () => {
    const element = mount({ disabled: '' });
    const events: Event[] = [];
    document.addEventListener('x-button-click', (event) => events.push(event));

    const blocked = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
    element.shadowRoot!.dispatchEvent(blocked);

    expect(blocked.defaultPrevented).toBe(true);
    expect(events).toHaveLength(0);
    expect(inner(element).disabled).toBe(true);
  });

  it('blocks clicks while loading and marks the internal button busy', () => {
    const element = mount({ loading: '' });
    const events: Event[] = [];
    document.addEventListener('x-button-click', (event) => events.push(event));

    const blocked = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
    element.shadowRoot!.dispatchEvent(blocked);

    expect(blocked.defaultPrevented).toBe(true);
    expect(events).toHaveLength(0);
    expect(inner(element).disabled).toBe(true);
    expect(inner(element).getAttribute('aria-busy')).toBe('true');
  });

  it('keeps the native button disabled so real pointer clicks never dispatch', () => {
    const element = mount({ disabled: '' });
    let emitted = 0;
    document.addEventListener('x-button-click', () => (emitted += 1));

    click(element);

    expect(emitted).toBe(0);
    expect(inner(element).disabled).toBe(true);
  });

  it('blocks and unblocks clicks as the disabled property toggles', () => {
    const element = mount();
    const events: Event[] = [];
    document.addEventListener('x-button-click', (event) => events.push(event));

    click(element);
    expect(events).toHaveLength(1);

    element.disabled = true;
    expect(inner(element).disabled).toBe(true);
    click(element);
    expect(events).toHaveLength(1);

    element.disabled = false;
    expect(inner(element).disabled).toBe(false);
    click(element);
    expect(events).toHaveLength(2);
  });

  it('renders the label through the default slot', () => {
    const element = mount({}, 'Pay now');
    expect(element.shadowRoot!.querySelector('slot')).not.toBeNull();
    expect(element.textContent).toBe('Pay now');
  });

  it('adopts the reset + component styles as a constructable stylesheet', () => {
    const element = mount();
    expect(element.shadowRoot!.adoptedStyleSheets).toHaveLength(1);
  });

  it('keeps the colour and custom-property contract in x-button.css', () => {
    const source = buttonCssSource;
    for (const token of [
      '--x-color-accent-9',
      '--x-color-danger-9',
      '--x-color-fg-1',
      '--x-color-bg-1',
      '--x-color-border-1',
      '--x-button-height',
      '--x-button-radius',
      '--x-button-font-size',
    ]) {
      expect(source).toContain(token);
    }
    // every colour token must carry a fallback, because @x/tokens may not be loaded
    expect(source).toMatch(/var\(--x-color-accent-9,\s*#/);
    expect(source).toMatch(/var\(--x-color-danger-9,\s*#/);
    expect(source).toMatch(/var\(--x-color-fg-1,\s*#/);
    expect(source).toMatch(/var\(--x-color-bg-1,\s*#/);
    expect(source).toMatch(/var\(--x-color-border-1,\s*#/);
    // CONTRACT §6: both theme entry points reach the component through tokens,
    // while `color-scheme` keeps native chrome in step with them.
    expect(source).toContain('color-scheme: light dark');
    expect(source).toContain(":host([data-theme='dark'])");
    expect(source).toContain(":host([data-theme='light'])");
  });

  it('guards the host against preflight via the shared reset', () => {
    const reset = resetCssSource;
    expect(reset).toContain(':host {');
    expect(reset).toContain('box-sizing: border-box');
    expect(reset).toContain('border: 0 solid');
    expect(reset).toContain('margin: 0');
    expect(reset).toContain('line-height: 1.5');
  });
});
