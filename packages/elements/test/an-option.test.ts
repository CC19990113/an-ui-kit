/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AnOption } from '../src/option/an-option';
import optionCssSource from '../src/option/an-option.css?inline';

// The component is not wired into `src/index.ts` yet, so the test registers it.
if (typeof customElements !== 'undefined' && !customElements.get('an-option')) {
  customElements.define('an-option', AnOption);
}

function create(text?: string): AnOption {
  const element = document.createElement('an-option') as AnOption;
  if (text !== undefined) element.textContent = text;
  return element;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('an-option', () => {
  it('is not form associated: the owning select submits the value', () => {
    expect(AnOption.formAssociated).toBe(false);
  });

  it('defaults value to the trimmed text content', () => {
    const element = create('  广州 ');
    expect(element.value).toBe('广州');

    element.value = 'GZ';
    expect(element.value).toBe('GZ');
    expect(element.getAttribute('value')).toBe('GZ');

    element.removeAttribute('value');
    expect(element.value).toBe('广州');
  });

  it('keeps an explicit empty value instead of falling back to the text', () => {
    const element = create('请选择');

    element.value = '';
    expect(element.getAttribute('value')).toBe('');
    expect(element.value).toBe('');
  });

  it('reflects disabled to the attribute and back', () => {
    const element = create('广州');
    expect(element.disabled).toBe(false);

    element.disabled = true;
    expect(element.hasAttribute('disabled')).toBe(true);

    element.removeAttribute('disabled');
    expect(element.disabled).toBe(false);

    element.setAttribute('disabled', '');
    expect(element.disabled).toBe(true);
  });

  it('defaults label to the trimmed text content', () => {
    const element = create('  广州 ');
    expect(element.label).toBe('广州');

    element.label = 'Guangzhou';
    expect(element.label).toBe('Guangzhou');

    element.removeAttribute('label');
    expect(element.label).toBe('广州');
  });

  it('drops an empty label attribute and falls back to the text', () => {
    const element = create('广州');

    element.setAttribute('label', '');
    expect(element.label).toBe('广州');

    element.label = 'Guangzhou';
    element.label = '';
    expect(element.hasAttribute('label')).toBe(false);
    expect(element.label).toBe('广州');
  });

  it('renders nothing and hides the host', () => {
    const element = create('广州');
    document.body.append(element);

    expect(element.shadowRoot!.innerHTML).toBe('');
    expect(element.shadowRoot!.adoptedStyleSheets).toHaveLength(1);
    expect(optionCssSource).toContain(':host {');
    expect(optionCssSource).toContain('display: none;');
  });
});
