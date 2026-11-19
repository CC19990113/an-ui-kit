/** @vitest-environment happy-dom */
// The shim must be installed before the component constructors run, so that a
// form-associated element finds `attachInternals()`. Static imports run in
// source order.
import './helpers/form-internals';
import { afterEach, describe, expect, it } from 'vitest';

import { AnCheckbox } from '../src/checkbox/an-checkbox';
import { AnCheckboxGroup } from '../src/checkbox-group/an-checkbox-group';
import groupCssSource from '../src/checkbox-group/an-checkbox-group.css?inline';
import { componentSuite } from './helpers/harness';
import { internalsState } from './helpers/form-internals';

// Not registered by `src/index.ts` yet; registering here also lets this file run
// on its own without depending on the shared entry point.
if (!customElements.get('an-checkbox')) {
  customElements.define('an-checkbox', AnCheckbox);
}
if (!customElements.get('an-checkbox-group')) {
  customElements.define('an-checkbox-group', AnCheckboxGroup);
}

/** CSS custom properties `<an-checkbox-group>` documents. */
const CSS_VARS = ['--an-checkbox-group-gap'];

interface Option {
  value: string;
  text?: string;
  attributes?: Record<string, string>;
}

interface GroupFixture {
  group: AnCheckboxGroup;
  boxes: AnCheckbox[];
  form: HTMLFormElement;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The inner native checkbox of one option. */
function inner(checkbox: AnCheckbox): HTMLInputElement {
  const input = checkbox.shadowRoot?.querySelector('input');
  if (!input) throw new Error('an-checkbox did not render its inner input');
  return input;
}

/**
 * Clicks the painted box the way a pointer would: the target is the decorative
 * sibling, not the native input, so this exercises the forwarding path.
 */
function click(checkbox: AnCheckbox): void {
  const control = checkbox.shadowRoot!.querySelector('[part~="control"]');
  if (!control) throw new Error('an-checkbox did not render its control');
  control.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }),
  );
}

function keydown(input: HTMLInputElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  input.dispatchEvent(event);
  return event;
}

/**
 * Builds a form + group + options detached first and only then connects the
 * tree, so every option is upgraded before the group renders — the same state
 * the parser produces for markup written in the documented order.
 */
function createGroup(options: {
  attributes?: Record<string, string>;
  values?: Option[];
} = {}): GroupFixture {
  const values = options.values ?? [
    { value: 'html', text: 'HTML' },
    { value: 'css', text: 'CSS' },
    { value: 'js', text: 'JavaScript' },
  ];
  const group = document.createElement('an-checkbox-group') as AnCheckboxGroup;
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    group.setAttribute(name, value);
  }
  const boxes = values.map((option) => {
    const checkbox = document.createElement('an-checkbox') as AnCheckbox;
    checkbox.setAttribute('value', option.value);
    for (const [name, value] of Object.entries(option.attributes ?? {})) {
      checkbox.setAttribute(name, value);
    }
    checkbox.textContent = option.text ?? option.value;
    return checkbox;
  });
  for (const checkbox of boxes) group.append(checkbox);

  const form = document.createElement('form');
  form.append(group);
  document.body.append(form);
  return { group, boxes, form };
}

afterEach(() => {
  document.body.innerHTML = '';
});

componentSuite({
  tag: 'an-checkbox-group',
  ctor: AnCheckboxGroup,
  defaults: {
    name: '',
    label: '',
    disabled: false,
    required: false,
    orientation: 'vertical',
    min: 0,
    max: 0,
  },
  events: ['an-checkbox-group-change'],
  cssVars: CSS_VARS,
  parts: ['base', 'group'],
});

describe('an-checkbox-group — structure and a11y', () => {
  it('renders a group named by its visible label', () => {
    const { group } = createGroup({ attributes: { label: '技术栈' } });

    const role = group.shadowRoot!.querySelector('[role="group"]')!;
    expect(role).not.toBeNull();
    expect(role.getAttribute('aria-labelledby')).toBe('group-label');
    expect(group.shadowRoot!.querySelector('#group-label')!.textContent).toBe('技术栈');
    expect(group.shadowRoot!.querySelector('[part~="group"]')).toBe(role);
    expect(group.shadowRoot!.querySelector('[part~="label"]')).not.toBeNull();
  });

  it('renders the label as text, never as markup', () => {
    const { group } = createGroup({
      attributes: { label: '<b>技术栈</b><img src=x onerror="window.pwned = 1">' },
    });

    const label = group.shadowRoot!.querySelector('[part~="label"]')!;
    expect(label.textContent).toBe('<b>技术栈</b><img src=x onerror="window.pwned = 1">');
    expect(label.querySelector('b')).toBeNull();
    expect(label.querySelector('img')).toBeNull();
  });

  it('forwards aria-label / aria-labelledby when there is no visible label', () => {
    const labelled = createGroup({ attributes: { 'aria-label': '技术栈' } }).group;
    expect(
      labelled.shadowRoot!.querySelector('[role="group"]')!.getAttribute('aria-label'),
    ).toBe('技术栈');
    expect(labelled.shadowRoot!.querySelector('[part~="label"]')).toBeNull();

    const described = createGroup({
      attributes: { 'aria-labelledby': 'tech-label' },
    }).group;
    expect(
      described.shadowRoot!.querySelector('[role="group"]')!.getAttribute('aria-labelledby'),
    ).toBe('tech-label');
  });

  it('marks the group required and disabled without a connected form', () => {
    const { group } = createGroup({ attributes: { required: '', disabled: '' } });

    expect(
      group.shadowRoot!.querySelector('[role="group"]')!.getAttribute('aria-required'),
    ).toBe('true');
    expect(group.getAttribute('aria-required')).toBe('true');
    expect(group.getAttribute('aria-disabled')).toBe('true');

    group.disabled = false;
    expect(group.getAttribute('aria-disabled')).toBeNull();
  });

  it('stacks options vertically by default and horizontally on request', () => {
    const vertical = createGroup().group;
    expect(vertical.orientation).toBe('vertical');
    expect(vertical.hasAttribute('orientation')).toBe(false);

    vertical.orientation = 'horizontal';
    expect(vertical.getAttribute('orientation')).toBe('horizontal');
    expect(groupCssSource).toContain(":host([orientation='horizontal'])");
  });

  it('reads min and max as numbers', () => {
    const { group } = createGroup({ attributes: { min: '2', max: '3' } });

    expect(group.min).toBe(2);
    expect(group.max).toBe(3);
  });
});

describe('an-checkbox-group — value model', () => {
  it('parses the comma-separated value attribute into a string array', () => {
    const { group } = createGroup({ attributes: { value: 'html, css' } });

    expect(group.value).toEqual(['html', 'css']);
  });

  it('drives the checked state of every option from the value', () => {
    const { group, boxes } = createGroup({ attributes: { value: 'css' } });

    expect(boxes[0].checked).toBe(false);
    expect(boxes[1].checked).toBe(true);
    expect(boxes[2].checked).toBe(false);

    group.value = ['html', 'js'];
    expect(boxes[0].checked).toBe(true);
    expect(boxes[1].checked).toBe(false);
    expect(boxes[2].checked).toBe(true);
  });

  it('reflects a property assignment back onto the attribute', () => {
    const { group } = createGroup();

    group.value = ['css', 'js'];
    expect(group.value).toEqual(['css', 'js']);
    expect(group.getAttribute('value')).toBe('css,js');

    group.value = [];
    expect(group.getAttribute('value')).toBeNull();
  });

  it('seeds the value from options marked checked in markup', async () => {
    const { group, boxes } = createGroup({
      values: [
        { value: 'html', attributes: { checked: '' } },
        { value: 'css' },
      ],
    });
    await flush();

    expect(group.value).toEqual(['html']);
    expect(boxes[0].checked).toBe(true);
    expect(boxes[1].checked).toBe(false);
  });

  it('selects and deselects on click, emitting a bubbling, composed event', () => {
    const { group, boxes } = createGroup();
    const seen: CustomEvent[] = [];
    const listener = (event: Event): void => {
      if (event.type === 'an-checkbox-group-change') seen.push(event as CustomEvent);
    };
    document.addEventListener('an-checkbox-group-change', listener);
    try {
      click(boxes[1]);
      expect(group.value).toEqual(['css']);
      expect(boxes[1].checked).toBe(true);

      click(boxes[1]);
      expect(group.value).toEqual([]);
      expect(boxes[1].checked).toBe(false);
    } finally {
      document.removeEventListener('an-checkbox-group-change', listener);
    }

    expect(seen).toHaveLength(2);
    expect(seen[0].detail.value).toEqual(['css']);
    expect(seen[0].detail.originalEvent.type).toBe('change');
    expect(seen[0].bubbles).toBe(true);
    expect(seen[0].composed).toBe(true);
    expect(seen[1].detail.value).toEqual([]);
  });

  it('keeps the value in DOM order regardless of the click order', () => {
    const { group, boxes } = createGroup();

    click(boxes[2]);
    click(boxes[0]);
    expect(group.value).toEqual(['html', 'js']);
  });

  it('toggles the focused option with Space and cancels the native activation', () => {
    const { group, boxes } = createGroup();

    const event = keydown(inner(boxes[0]), ' ');

    expect(event.defaultPrevented).toBe(true);
    expect(group.value).toEqual(['html']);
    expect(boxes[0].checked).toBe(true);
  });

  it('moves focus with the arrow keys and wraps at both ends', () => {
    const { boxes } = createGroup();

    inner(boxes[0]).focus();
    keydown(inner(boxes[0]), 'ArrowDown');
    expect(boxes[1].shadowRoot!.activeElement).toBe(inner(boxes[1]));

    keydown(inner(boxes[1]), 'ArrowRight');
    expect(boxes[2].shadowRoot!.activeElement).toBe(inner(boxes[2]));

    keydown(inner(boxes[2]), 'ArrowRight');
    expect(boxes[0].shadowRoot!.activeElement).toBe(inner(boxes[0]));

    keydown(inner(boxes[0]), 'ArrowUp');
    expect(boxes[2].shadowRoot!.activeElement).toBe(inner(boxes[2]));
  });

  it('jumps to the first and last enabled option with Home / End', () => {
    const { boxes } = createGroup();

    inner(boxes[1]).focus();
    keydown(inner(boxes[1]), 'End');
    expect(boxes[2].shadowRoot!.activeElement).toBe(inner(boxes[2]));

    keydown(inner(boxes[2]), 'Home');
    expect(boxes[0].shadowRoot!.activeElement).toBe(inner(boxes[0]));
  });

  it('skips disabled options when moving focus', () => {
    const { boxes } = createGroup({
      values: [
        { value: 'html' },
        { value: 'css', attributes: { disabled: '' } },
        { value: 'js' },
      ],
    });

    inner(boxes[0]).focus();
    keydown(inner(boxes[0]), 'ArrowDown');
    expect(boxes[2].shadowRoot!.activeElement).toBe(inner(boxes[2]));
  });

  it('keeps exactly one enabled option in the tab order', async () => {
    const { boxes } = createGroup();
    await flush();

    expect(inner(boxes[0]).getAttribute('tabindex')).toBe('0');
    expect(inner(boxes[1]).getAttribute('tabindex')).toBe('-1');
    expect(inner(boxes[2]).getAttribute('tabindex')).toBe('-1');

    keydown(inner(boxes[0]), 'ArrowDown');
    expect(inner(boxes[0]).getAttribute('tabindex')).toBe('-1');
    expect(inner(boxes[1]).getAttribute('tabindex')).toBe('0');
  });

  it('puts the tab stop on the selected option when a value is given up front', async () => {
    const { boxes } = createGroup({ attributes: { value: 'css' } });
    await flush();

    expect(inner(boxes[0]).getAttribute('tabindex')).toBe('-1');
    expect(inner(boxes[1]).getAttribute('tabindex')).toBe('0');
    expect(inner(boxes[2]).getAttribute('tabindex')).toBe('-1');
  });

  it('ignores a synthetic change while the group is disabled and rolls it back', () => {
    const { group, boxes } = createGroup({ attributes: { disabled: '' } });

    boxes[0].checked = true;
    boxes[0].dispatchEvent(
      new CustomEvent('an-checkbox-change', {
        bubbles: true,
        composed: true,
        detail: { checked: true, value: 'html', originalEvent: new Event('change') },
      }),
    );

    expect(group.value).toEqual([]);
    expect(boxes[0].checked).toBe(false);
  });
});

describe('an-checkbox-group — disabled and form semantics', () => {
  it('cascades disabled onto every option and restores their own state', () => {
    const { group, boxes } = createGroup();
    expect(boxes[0].disabled).toBe(false);

    group.disabled = true;
    expect(boxes.every((checkbox) => checkbox.disabled)).toBe(true);

    group.disabled = false;
    expect(boxes.every((checkbox) => checkbox.disabled)).toBe(false);
  });

  it('does not lose an option that was already disabled on its own', () => {
    const { group, boxes } = createGroup({
      values: [{ value: 'html', attributes: { disabled: '' } }, { value: 'css' }],
    });

    group.disabled = true;
    group.disabled = false;

    expect(boxes[0].disabled).toBe(true);
    expect(boxes[1].disabled).toBe(false);
  });

  it('blocks selection and clears the form entry while disabled', () => {
    const { group, boxes, form } = createGroup({
      attributes: { name: 'langs', value: 'html' },
    });

    group.disabled = true;
    click(boxes[1]);
    expect(group.value).toEqual(['html']);
    expect(internalsState(group)!.value).toBeNull();
    expect(new FormData(form).has('langs')).toBe(false);

    group.disabled = false;
    expect(internalsState(group)!.value).toBe('html');
    expect(new FormData(form).get('langs')).toBe('html');
  });

  it('submits one entry per selected value under the same name', () => {
    const { group } = createGroup({
      attributes: { name: 'langs', value: 'html,css' },
    });

    const data = group.getFormData();
    expect(data).not.toBeNull();
    expect(data!.getAll('langs')).toEqual(['html', 'css']);
  });

  it('submits nothing without a name or with the group disabled', () => {
    const unnamed = createGroup().group;
    expect(unnamed.getFormData()).toBeNull();

    const { group } = createGroup({ attributes: { name: 'langs', value: 'html' } });
    group.disabled = true;
    expect(group.getFormData()).toBeNull();
  });

  it('reports valueMissing when required and nothing is selected', () => {
    const { group, boxes } = createGroup({ attributes: { required: '' } });

    const state = internalsState(group)!;
    expect(state.flags).toEqual({ valueMissing: true });
    expect(state.message).toBe('请至少选择一个选项');
    expect(state.anchor).toBe(inner(boxes[0]));
    expect(group.validity!.valueMissing).toBe(true);
    expect(group.validationMessage).toBe('请至少选择一个选项');

    click(boxes[0]);
    expect(internalsState(group)!.flags).toEqual({});
    expect(group.validity!.valid).toBe(true);
  });

  it('reports customError below min with the Chinese message', () => {
    const { group, boxes } = createGroup({
      attributes: { required: '', min: '2' },
    });

    click(boxes[0]);
    expect(internalsState(group)!.flags).toEqual({ customError: true });
    expect(group.validationMessage).toBe('至少选择 2 项');

    click(boxes[1]);
    expect(internalsState(group)!.flags).toEqual({});
  });

  it('reports customError above max with the Chinese message', () => {
    const { group, boxes } = createGroup({ attributes: { max: '1' } });

    click(boxes[0]);
    click(boxes[1]);
    expect(internalsState(group)!.flags).toEqual({ customError: true });
    expect(group.validationMessage).toBe('最多选择 1 项');

    click(boxes[1]);
    expect(internalsState(group)!.flags).toEqual({});
  });

  it('restores the initial selection on reset()', () => {
    const { group, boxes } = createGroup({ attributes: { value: 'css' } });

    click(boxes[0]);
    expect(group.value).toEqual(['html', 'css']);

    group.reset();
    expect(group.value).toEqual(['css']);
    expect(boxes[1].checked).toBe(true);
    expect(boxes[0].checked).toBe(false);
  });

  it('restores the initial selection when the owning form is reset', async () => {
    const { group, boxes, form } = createGroup({
      attributes: { name: 'langs', value: 'html' },
    });

    click(boxes[2]);
    expect(group.value).toEqual(['html', 'js']);

    form.reset();
    // The checkbox options are form-associated too and are reset to their own
    // mounted state right after the group; the group re-asserts on a microtask.
    await flush();
    expect(group.value).toEqual(['html']);
    expect(boxes[0].checked).toBe(true);
    expect(boxes[2].checked).toBe(false);
  });

  it('shows the full list of values in the change event after several picks', () => {
    const { group, boxes } = createGroup();
    const seen: string[][] = [];
    group.addEventListener('an-checkbox-group-change', (event) => {
      seen.push((event as CustomEvent).detail.value);
    });

    click(boxes[0]);
    click(boxes[2]);

    expect(seen).toEqual([['html'], ['html', 'js']]);
  });
});
