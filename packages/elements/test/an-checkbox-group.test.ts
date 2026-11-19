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
    selectAll: false,
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
    const payload = internalsState(group)!.value;
    expect(payload).toBeInstanceOf(FormData);
    expect((payload as FormData).getAll('langs')).toEqual(['html']);
    expect(new FormData(form).getAll('langs')).toEqual(['html']);
  });

  it('uses a native FormData payload with one same-name entry per selected option', () => {
    const { group, boxes, form } = createGroup({
      attributes: { name: 'langs', value: 'html,css' },
    });
    const payload = internalsState(group)!.value;

    expect(payload).toBeInstanceOf(FormData);
    expect((payload as FormData).getAll('langs')).toEqual(['html', 'css']);
    expect(group.getFormData()!.getAll('langs')).toEqual(['html', 'css']);
    expect(new FormData(form).getAll('langs')).toEqual(['html', 'css']);
    // Child checkboxes have no name and the group is the only form owner.
    expect(new FormData(form).getAll('')).toEqual([]);

    click(boxes[0]);
    expect((internalsState(group)!.value as FormData).getAll('langs')).toEqual(['css']);
    expect(new FormData(form).getAll('langs')).toEqual(['css']);

    group.disabled = true;
    expect(internalsState(group)!.value).toBeNull();
    expect(new FormData(form).getAll('langs')).toEqual([]);
    group.disabled = false;
    expect(new FormData(form).getAll('langs')).toEqual(['css']);
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

// ---------------------------------------------------------------------------
// `select-all`: the header checkbox that reflects and drives the whole group.
// ---------------------------------------------------------------------------

/** The select-all header input, or `null` when the attribute is off. */
function selectAll(group: AnCheckboxGroup): HTMLInputElement | null {
  return group.shadowRoot!.querySelector<HTMLInputElement>('[part~="select-all"]');
}

/** Clicks the header checkbox the way a pointer would. */
function clickSelectAll(group: AnCheckboxGroup): void {
  const input = selectAll(group);
  if (!input) throw new Error('an-checkbox-group did not render the select-all input');
  input.checked = !input.checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Collects `an-checkbox-group-change` payloads. */
function groupChanges(group: AnCheckboxGroup): CustomEvent[] {
  const seen: CustomEvent[] = [];
  group.addEventListener('an-checkbox-group-change', (event) => seen.push(event as CustomEvent));
  return seen;
}

describe('an-checkbox-group — select-all rendering', () => {
  it('renders no header by default', () => {
    const { group } = createGroup();
    expect(group.selectAll).toBe(false);
    expect(selectAll(group)).toBeNull();
    expect(group.shadowRoot!.querySelector('[part~="select-all-label"]')).toBeNull();
  });

  it('renders a `part="select-all"` checkbox with its label when enabled', async () => {
    const { group } = createGroup({ attributes: { 'select-all': '' } });
    // `selectAll` is applied synchronously; the flush keeps the pattern uniform.
    await flush();
    expect(group.selectAll).toBe(true);
    const input = selectAll(group);
    expect(input).not.toBeNull();
    expect(input!.type).toBe('checkbox');
    expect(input!.getAttribute('part')).toBe('select-all');
    expect(input!.closest('[part~="select-all-label"]')).not.toBeNull();
    const text = group.shadowRoot!.querySelector('[part~="select-all-text"]');
    expect(text!.textContent).toBe('全选');
  });

  it('starts unchecked and unpressed while nothing is selected', () => {
    const { group } = createGroup({ attributes: { 'select-all': '' } });

    const input = selectAll(group)!;
    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(false);
    expect(input.hasAttribute('aria-checked')).toBe(false);
  });

  it('is checked once every enabled option is selected', () => {
    const { group } = createGroup({ attributes: { 'select-all': '', value: 'html,css,js' } });

    const input = selectAll(group)!;
    expect(input.checked).toBe(true);
    expect(input.indeterminate).toBe(false);
  });

  it('is indeterminate with `aria-checked="mixed"` on a partial selection', () => {
    const { group } = createGroup({ attributes: { 'select-all': '', value: 'html' } });

    const input = selectAll(group)!;
    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(true);
    expect(input.getAttribute('aria-checked')).toBe('mixed');
  });

  it('renders no header when the attribute is removed again', () => {
    const { group } = createGroup({ attributes: { 'select-all': '' } });
    expect(selectAll(group)).not.toBeNull();

    group.selectAll = false;

    expect(group.hasAttribute('select-all')).toBe(false);
    expect(selectAll(group)).toBeNull();
  });
});

describe('an-checkbox-group — select-all interaction', () => {
  it('selects every option when the header is clicked', async () => {
    const { group, boxes } = createGroup({ attributes: { 'select-all': '' } });
    await flush();
    const changes = groupChanges(group);

    clickSelectAll(group);
    await flush();

    expect(group.value).toEqual(['html', 'css', 'js']);
    expect(boxes.map((box) => box.checked)).toEqual([true, true, true]);
    expect(changes).toHaveLength(1);
    expect(changes[0].detail.value).toEqual(['html', 'css', 'js']);
  });

  it('clears every option when the checked header is clicked again', async () => {
    const { group, boxes } = createGroup({
      attributes: { 'select-all': '', value: 'html,css,js' },
    });
    await flush();
    const changes = groupChanges(group);

    clickSelectAll(group);
    await flush();

    expect(group.value).toEqual([]);
    expect(boxes.map((box) => box.checked)).toEqual([false, false, false]);
    expect(changes).toHaveLength(1);
    expect(changes[0].detail.value).toEqual([]);
  });

  it('completes a partial selection instead of clearing it', async () => {
    const { group } = createGroup({ attributes: { 'select-all': '', value: 'html' } });
    await flush();

    clickSelectAll(group);
    await flush();

    expect(group.value).toEqual(['html', 'css', 'js']);
    expect(selectAll(group)!.checked).toBe(true);
    expect(selectAll(group)!.indeterminate).toBe(false);
  });

  it('reports the checkbox that started the change in `originalEvent`', async () => {
    const { group } = createGroup({ attributes: { 'select-all': '' } });
    await flush();
    const changes = groupChanges(group);

    clickSelectAll(group);
    await flush();

    expect(changes[0].detail.originalEvent).toBeInstanceOf(Event);
  });

  it('leaves a disabled option out of the selection', async () => {
    const { group } = createGroup({
      attributes: { 'select-all': '' },
      values: [
        { value: 'html', text: 'HTML' },
        { value: 'css', text: 'CSS', attributes: { disabled: '' } },
        { value: 'js', text: 'JavaScript' },
      ],
    });
    await flush();

    clickSelectAll(group);
    await flush();

    expect(group.value).toEqual(['html', 'js']);
    expect(group.value).not.toContain('css');
    // Every enabled option being selected still reads as "checked".
    expect(selectAll(group)!.checked).toBe(true);
    expect(selectAll(group)!.indeterminate).toBe(false);
  });

  it('keeps the header checked state in step after a single option changes', async () => {
    const { group, boxes } = createGroup({ attributes: { 'select-all': '' } });
    await flush();
    expect(selectAll(group)!.checked).toBe(false);

    click(boxes[0]);
    await flush();

    expect(selectAll(group)!.checked).toBe(false);
    expect(selectAll(group)!.indeterminate).toBe(true);

    click(boxes[1]);
    click(boxes[2]);
    await flush();

    expect(selectAll(group)!.checked).toBe(true);
    expect(selectAll(group)!.indeterminate).toBe(false);
  });
});

describe('an-checkbox-group — select-all disabled cascade', () => {
  it('disables the header while the group itself is disabled', () => {
    const { group } = createGroup({ attributes: { 'select-all': '', disabled: '' } });

    const input = selectAll(group)!;
    expect(group.disabled).toBe(true);
    expect(input.disabled).toBe(true);
  });

  it('disables the header when no option is enabled', () => {
    const { group } = createGroup({
      attributes: { 'select-all': '' },
      values: [{ value: 'only', text: 'ONLY', attributes: { disabled: '' } }],
    });

    expect(selectAll(group)!.disabled).toBe(true);
  });

  it('re-enables the header once an option becomes available again', async () => {
    const { group, boxes } = createGroup({ attributes: { 'select-all': '' } });
    await flush();
    expect(selectAll(group)!.disabled).toBe(false);

    boxes[0].disabled = true;
    await flush();
    expect(selectAll(group)!.disabled).toBe(false);

    boxes[1].disabled = true;
    boxes[2].disabled = true;
    await flush();
    // Now nothing is selectable, so the header goes inert.
    expect(selectAll(group)!.disabled).toBe(true);
  });

  it('does nothing when the header of a disabled group is clicked anyway', async () => {
    const { group } = createGroup({ attributes: { 'select-all': '', disabled: '' } });
    await flush();
    const changes = groupChanges(group);

    clickSelectAll(group);
    await flush();

    expect(group.value).toEqual([]);
    expect(changes).toHaveLength(0);
  });
});
