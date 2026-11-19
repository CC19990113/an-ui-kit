/** @vitest-environment happy-dom */
// The shim installs before the element is defined, so the constructor's
// `attachInternals()` call finds it. Static imports are evaluated in order.
import './helpers/form-internals';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import groupCssSource from '../src/option-group/an-option-group.css?inline';
import { AnOptionGroup } from '../src/option-group/an-option-group';

// `<an-option-group>` is not exported from `src/index.ts`, so this suite
// registers it itself; the guard keeps the file safe if that changes.
if (typeof customElements !== 'undefined' && !customElements.get('an-option-group')) {
  customElements.define('an-option-group', AnOptionGroup);
}

/** Builds one group with the given attributes and `<an-option>` children. */
function create(
  attributes: Record<string, string> = {},
  children = '<an-option value="sh">上海</an-option>',
): AnOptionGroup {
  const element = document.createElement('an-option-group') as AnOptionGroup;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (children.length > 0) element.innerHTML = children;
  return element;
}

function mount(
  attributes: Record<string, string> = {},
  children?: string,
): AnOptionGroup {
  const element = create(attributes, children);
  document.body.append(element);
  return element;
}

function groupStyles(element: AnOptionGroup): string {
  const root = element.shadowRoot;
  if (!root) throw new Error('an-option-group has no shadow root');
  // happy-dom prefers the adopted sheet; fall back to the injected <style>.
  const sheet = root.adoptedStyleSheets?.[0];
  if (sheet) return Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
  return root.querySelector('style')?.textContent ?? '';
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('an-option-group — registration and defaults', () => {
  it('registers under `an-option-group` and is a custom element instance', () => {
    expect(customElements.get('an-option-group')).toBe(AnOptionGroup);
    const element = mount();
    expect(element).toBeInstanceOf(AnOptionGroup);
    expect(element).toBeInstanceOf(HTMLElement);
  });

  it('starts with an empty label and enabled state', () => {
    const element = mount();
    expect(element.label).toBe('');
    expect(element.disabled).toBe(false);
    expect(element.hasAttribute('label')).toBe(false);
    expect(element.hasAttribute('disabled')).toBe(false);
    expect(AnOptionGroup.defaults).toEqual({ label: '', disabled: false });
  });

  it('is not form-associated: groups carry data, never a submitted value', () => {
    // `AnElement` opts every subclass out by default; the group never opts in.
    expect(AnOptionGroup.formAssociated).toBe(false);
    const element = mount({ label: '华东' });
    expect(element.getFormData()).toBeNull();
  });
});

describe('an-option-group — attribute / property reflection', () => {
  it('reflects `label` in both directions', () => {
    const element = mount();
    element.label = '华东';
    expect(element.getAttribute('label')).toBe('华东');

    element.setAttribute('label', '华北');
    expect(element.label).toBe('华北');

    element.label = '';
    expect(element.hasAttribute('label')).toBe(false);
    expect(element.label).toBe('');
  });

  it('reflects `disabled` as a presence attribute', () => {
    const element = mount();
    element.disabled = true;
    expect(element.hasAttribute('disabled')).toBe(true);
    expect(element.disabled).toBe(true);

    element.setAttribute('disabled', '');
    expect(element.disabled).toBe(true);

    element.removeAttribute('disabled');
    expect(element.disabled).toBe(false);

    element.disabled = false;
    expect(element.hasAttribute('disabled')).toBe(false);
  });

  it('reads attributes set before the element is connected', () => {
    const element = create({ label: '华南', disabled: '' });
    expect(element.label).toBe('华南');
    expect(element.disabled).toBe(true);
    document.body.append(element);
    expect(element.label).toBe('华南');
    expect(element.disabled).toBe(true);
  });
});

describe('an-option-group — rendering contract', () => {
  it('renders no markup of its own: the select paints the option list', () => {
    const element = mount({ label: '华东' }, '<an-option value="sh">上海</an-option>');
    expect(element.shadowRoot).not.toBeNull();
    expect(element.shadowRoot!.innerHTML).toBe('');
  });

  it('keeps its `<an-option>` children in the light DOM', () => {
    const element = mount(
      { label: '华东' },
      '<an-option value="sh">上海</an-option><an-option value="hz">杭州</an-option>',
    );
    const options = Array.from(element.children);
    expect(options.map((child) => child.localName)).toEqual(['an-option', 'an-option']);
    expect(options.map((child) => child.getAttribute('value'))).toEqual(['sh', 'hz']);
  });

  it('falls back to the trimmed text content when `label` is missing', () => {
    // Same contract as `<an-option>`: an absent label is the element's own text,
    // so a group authored without `label` still names itself from its markup.
    const element = mount({}, '\n  华东  \n');
    expect(element.hasAttribute('label')).toBe(false);
    expect(element.label).toBe('华东');
  });

  it('prefers an explicit `label` over the text content', () => {
    const element = mount({ label: '华东' }, '忽略这段文字');
    expect(element.label).toBe('华东');

    // Clearing the attribute falls back again.
    element.removeAttribute('label');
    expect(element.label).toBe('忽略这段文字');
  });

  it('hides the host with `display: none` so the list is painted once', () => {
    mount({ label: '华东' });
    expect(groupCssSource).toContain(':host {');
    expect(groupCssSource).toContain('display: none;');
    expect(AnOptionGroup.styles).toBe(groupCssSource);
  });

  it('adopts exactly one stylesheet and keeps it across re-renders', () => {
    const element = mount({ label: '华东' });
    const sheets = element.shadowRoot!.adoptedStyleSheets;
    if (sheets.length > 0) {
      expect(sheets).toHaveLength(1);
      expect(Array.from(sheets[0].cssRules).map((rule) => rule.cssText).join('\n')).toContain(
        'display: none',
      );
    } else {
      // Fallback path: the <style> node is adopted instead.
      expect(groupStyles(element)).toContain('display: none');
    }
  });
});

describe('an-option-group — manual registration', () => {
  it('does not throw when defined twice: the guard keeps the first constructor', () => {
    const before = customElements.get('an-option-group');
    expect(() => customElements.define('an-option-group', class extends HTMLElement {})).toThrow(
      /already been used|already defined/i,
    );
    expect(customElements.get('an-option-group')).toBe(before);
    expect(customElements.get('an-option-group')).toBe(AnOptionGroup);
  });

  it('can be defined with its own tag name, proving the class is plugin-free', () => {
    class ShadowGroup extends AnOptionGroup {}
    if (!customElements.get('an-shadow-option-group')) {
      customElements.define('an-shadow-option-group', ShadowGroup);
    }
    const element = document.createElement('an-shadow-option-group') as ShadowGroup;
    element.setAttribute('label', '华东');
    document.body.append(element);

    expect(element).toBeInstanceOf(AnOptionGroup);
    expect(element.label).toBe('华东');
    expect(element.shadowRoot!.innerHTML).toBe('');
  });
});

describe('an-option-group — multi-group authoring', () => {
  it('keeps each group a separate element with its own state', () => {
    const east = create({ label: '华东' }, '<an-option value="sh">上海</an-option>');
    const north = create(
      { label: '华北', disabled: '' },
      '<an-option value="bj">北京</an-option>',
    );
    document.body.append(east, north);

    expect(east.label).toBe('华东');
    expect(east.disabled).toBe(false);
    expect(north.label).toBe('华北');
    expect(north.disabled).toBe(true);
    expect(Array.from(document.querySelectorAll('an-option-group'))).toHaveLength(2);
  });

  it('is disconnectable and reconnectable without losing its attributes', () => {
    const element = mount({ label: '华东', disabled: '' });
    element.remove();
    expect(element.isConnected).toBe(false);
    expect(element.label).toBe('华东');
    expect(element.disabled).toBe(true);

    document.body.append(element);
    expect(element.isConnected).toBe(true);
    expect(element.label).toBe('华东');
    expect(element.disabled).toBe(true);
  });
});
