/** @vitest-environment happy-dom */
// The shim must be installed before the component constructors run, so that a
// form-associated element finds `attachInternals()`. Static imports run in
// source order.
import './helpers/form-internals';
import { afterEach, describe, expect, it } from 'vitest';

import { AnRadio } from '../src/radio/an-radio';
import { AnRadioGroup } from '../src/radio-group/an-radio-group';
import groupCssSource from '../src/radio-group/an-radio-group.css?inline';
import { componentSuite } from './helpers/harness';
import { internalsState } from './helpers/form-internals';

if (!customElements.get('an-radio')) {
  customElements.define('an-radio', AnRadio);
}
if (!customElements.get('an-radio-group')) {
  customElements.define('an-radio-group', AnRadioGroup);
}

/** CSS custom properties `<an-radio-group>` documents. */
const CSS_VARS = ['--an-radio-group-gap'];

interface Option {
  value: string;
  text?: string;
  attributes?: Record<string, string>;
}

interface GroupFixture {
  group: AnRadioGroup;
  radios: AnRadio[];
  form: HTMLFormElement;
}

/** The inner native radio of one option. */
function inner(radio: AnRadio): HTMLInputElement {
  const input = radio.shadowRoot?.querySelector('input');
  if (!input) throw new Error('an-radio did not render its inner input');
  return input;
}

function createOption(option: Option): AnRadio {
  const radio = document.createElement('an-radio') as AnRadio;
  radio.setAttribute('value', option.value);
  for (const [name, value] of Object.entries(option.attributes ?? {})) {
    radio.setAttribute(name, value);
  }
  radio.textContent = option.text ?? option.value;
  return radio;
}

/**
 * Builds a form + group + options detached first and only then connects the
 * tree, so every option is upgraded before the group renders — the same state
 * the parser produces for markup written in the documented order.
 */
function createGroup(options: {
  attributes?: Record<string, string>;
  values?: Option[];
  fieldset?: boolean;
} = {}): GroupFixture {
  const values = options.values ?? [
    { value: 'free', text: '免费' },
    { value: 'pro', text: '专业' },
  ];
  const group = document.createElement('an-radio-group') as AnRadioGroup;
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    group.setAttribute(name, value);
  }
  const radios = values.map(createOption);
  for (const radio of radios) group.append(radio);

  const form = document.createElement('form');
  if (options.fieldset) {
    const fieldset = document.createElement('fieldset');
    fieldset.append(group);
    form.append(fieldset);
  } else {
    form.append(group);
  }
  document.body.append(form);
  return { group, radios, form };
}

/** Resolves after the platform's microtask-level reactions have run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

afterEach(() => {
  document.body.innerHTML = '';
});

componentSuite({
  tag: 'an-radio-group',
  ctor: AnRadioGroup,
  defaults: { name: '', label: '', disabled: false, required: false },
  events: ['an-radio-change'],
  cssVars: CSS_VARS,
  parts: ['base', 'group'],
});

describe('an-radio-group — structure and a11y', () => {
  it('renders a radiogroup named by its visible label', () => {
    const { group } = createGroup({ attributes: { label: '套餐' } });

    const role = group.shadowRoot!.querySelector('[role="radiogroup"]')!;
    expect(role).not.toBeNull();
    expect(role.getAttribute('aria-labelledby')).toBe('group-label');
    expect(group.shadowRoot!.querySelector('#group-label')!.textContent).toBe('套餐');
    expect(group.shadowRoot!.querySelector('[part~="group"]')).toBe(role);
  });

  it('forwards aria-label / aria-labelledby when there is no visible label', () => {
    const labelled = createGroup({ attributes: { 'aria-label': '套餐' } }).group;
    expect(
      labelled.shadowRoot!.querySelector('[role="radiogroup"]')!.getAttribute('aria-label'),
    ).toBe('套餐');
    expect(labelled.shadowRoot!.querySelector('[part~="label"]')).toBeNull();
  });

  it('marks the radiogroup required', () => {
    const { group } = createGroup({ attributes: { required: '' } });

    expect(
      group.shadowRoot!.querySelector('[role="radiogroup"]')!.getAttribute('aria-required'),
    ).toBe('true');
    expect(group.getAttribute('aria-required')).toBe('true');
  });

  it('renders the group label as text, never as markup', () => {
    const { group } = createGroup({
      attributes: { label: '<b>套餐</b><img src=x onerror="window.pwned = 1">' },
    });

    expect(group.shadowRoot!.querySelector('b, img')).toBeNull();
    expect(group.shadowRoot!.querySelector('#group-label')!.textContent).toBe(
      '<b>套餐</b><img src=x onerror="window.pwned = 1">',
    );
  });

  it('renders the label part only when the group has a label', () => {
    const bare = createGroup().group;
    expect(bare.shadowRoot!.querySelector('[part~="label"]')).toBeNull();

    const labelled = createGroup({ attributes: { label: '套餐' } }).group;
    expect(labelled.shadowRoot!.querySelector('[part~="label"]')).not.toBeNull();
  });

  it('exposes its stylesheet as a static style source', () => {
    expect(AnRadioGroup.styles).toBe(groupCssSource);
  });
});

describe('an-radio-group — selection', () => {
  it('selects the option named by the value attribute on mount', () => {
    const { group, radios } = createGroup({ attributes: { value: 'pro' } });

    expect(group.value).toBe('pro');
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
    expect(radios[1].hasAttribute('checked')).toBe(true);
    expect(radios[0].hasAttribute('checked')).toBe(false);
    expect(inner(radios[1]).checked).toBe(true);
    expect(inner(radios[1]).getAttribute('aria-checked')).toBe('true');
    expect(inner(radios[0]).getAttribute('aria-checked')).toBe('false');
  });

  it('selects an option on click and emits an-radio-change', () => {
    const { group, radios } = createGroup();
    const seen: CustomEvent[] = [];
    const listener = (event: Event): void => {
      seen.push(event as CustomEvent);
    };
    document.addEventListener('an-radio-change', listener);
    try {
      radios[0].click();
    } finally {
      document.removeEventListener('an-radio-change', listener);
    }

    expect(group.value).toBe('free');
    expect(radios[0].checked).toBe(true);
    expect(radios[1].checked).toBe(false);
    expect(seen).toHaveLength(1);
    expect(seen[0].bubbles).toBe(true);
    expect(seen[0].composed).toBe(true);
    expect(seen[0].detail.value).toBe('free');
    expect(seen[0].detail.originalEvent).toBeInstanceOf(Event);
  });

  it('moves the selection when another option is clicked', () => {
    const { group, radios } = createGroup({ attributes: { value: 'free' } });
    const values: string[] = [];
    group.addEventListener('an-radio-change', (event) => {
      values.push((event as CustomEvent).detail.value);
    });

    radios[1].click();

    expect(group.value).toBe('pro');
    expect(values).toEqual(['pro']);
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
    expect(inner(radios[0]).checked).toBe(false);
  });

  it('does not reflect a programmatic value onto the attribute', () => {
    const { group, radios } = createGroup();

    expect(group.hasAttribute('value')).toBe(false);
    group.value = 'pro';

    expect(group.hasAttribute('value')).toBe(false);
    expect(group.value).toBe('pro');
    expect(radios[1].checked).toBe(true);
    expect(radios[0].checked).toBe(false);
  });

  it('does not emit an event for a programmatic value', () => {
    const { group } = createGroup();
    let count = 0;
    group.addEventListener('an-radio-change', () => {
      count += 1;
    });

    group.value = 'pro';

    expect(count).toBe(0);
  });

  it('adopts a checked child as the initial selection', async () => {
    const { group, radios } = createGroup({
      values: [
        { value: 'free', text: '免费' },
        { value: 'pro', text: '专业', attributes: { checked: '' } },
      ],
    });
    await flush();

    expect(group.value).toBe('pro');
    expect(radios[1].checked).toBe(true);
    expect(radios[0].checked).toBe(false);
  });

  it('keeps exactly one tab stop inside the group', () => {
    const { radios } = createGroup({ attributes: { value: 'pro' } });

    expect(radios[0].tabbable).toBe(false);
    expect(inner(radios[0]).getAttribute('tabindex')).toBe('-1');
    expect(radios[1].tabbable).toBe(true);
    expect(inner(radios[1]).getAttribute('tabindex')).toBe('0');
  });

  it('syncs an option appended after mount', async () => {
    const { group, radios } = createGroup({ attributes: { value: 'pro' } });
    const late = createOption({ value: 'team', text: '团队' });

    group.append(late);
    await flush();

    expect(late.checked).toBe(false);
    expect(late.tabbable).toBe(false);
    late.click();
    expect(group.value).toBe('team');
    expect(radios[1].checked).toBe(false);
  });
});

describe('an-radio-group — disabled', () => {
  it('disables every option when the group is disabled', () => {
    const { group, radios } = createGroup({
      attributes: { disabled: '', name: 'plan', value: 'pro' },
    });
    let count = 0;
    group.addEventListener('an-radio-change', () => {
      count += 1;
    });

    for (const radio of radios) {
      expect(radio.disabled).toBe(true);
      expect(radio.hasAttribute('disabled')).toBe(true);
      expect(inner(radio).disabled).toBe(true);
    }
    radios[0].click();

    expect(group.value).toBe('pro');
    expect(count).toBe(0);
    expect(internalsState(group)!.value).toBeNull();
    expect(internalsState(group)!.flags).toEqual({});
  });

  it('respects an option that disables itself', () => {
    const { group, radios } = createGroup({
      values: [
        { value: 'free', text: '免费', attributes: { disabled: '' } },
        { value: 'pro', text: '专业' },
      ],
    });

    expect(radios[0].disabled).toBe(true);
    radios[0].click();
    expect(group.value).toBe('');

    radios[1].click();
    expect(group.value).toBe('pro');

    // A group-level disable must not erase the option's own disabled state.
    group.disabled = true;
    group.disabled = false;
    expect(radios[0].disabled).toBe(true);
    expect(radios[1].disabled).toBe(false);
  });

  it('clears the form value of a disabled group', () => {
    const { group, radios, form } = createGroup({
      attributes: { name: 'plan', value: 'pro', disabled: '' },
    });

    expect(new FormData(form).has('plan')).toBe(false);
    group.disabled = false;

    expect(new FormData(form).get('plan')).toBe('pro');
    expect(radios[1].checked).toBe(true);
  });
});

describe('an-radio-group — form semantics', () => {
  it('registers the selected value with the owning form', () => {
    const { group, form } = createGroup({
      attributes: { name: 'plan', value: 'pro' },
    });

    expect(new FormData(form).get('plan')).toBe('pro');

    group.value = 'free';
    expect(new FormData(form).get('plan')).toBe('free');
  });

  it('blocks requestSubmit with valueMissing when required and empty', async () => {
    const { group, radios, form } = createGroup({
      attributes: { name: 'plan', required: '' },
    });
    await flush();
    const invalid: Event[] = [];
    let submitted = 0;
    group.addEventListener('invalid', (event) => invalid.push(event));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted += 1;
    });

    form.requestSubmit();

    expect(submitted).toBe(0);
    expect(invalid).toHaveLength(1);
    const state = internalsState(group)!;
    expect(state.flags).toEqual({ valueMissing: true });
    expect(state.message).toBe('请选择一个选项');
    expect(state.anchor).toBe(inner(radios[0]));
  });

  it('submits once a required group has a selection', () => {
    const { group, radios, form } = createGroup({
      attributes: { name: 'plan', required: '' },
    });
    let submitted = 0;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted += 1;
    });

    radios[1].click();
    form.requestSubmit();

    expect(submitted).toBe(1);
    expect(internalsState(group)!.flags).toEqual({});
    expect(new FormData(form).get('plan')).toBe('pro');
  });

  it('restores the initial selection on form.reset()', () => {
    const { group, radios, form } = createGroup({
      attributes: { name: 'plan', value: 'pro' },
    });

    radios[0].click();
    expect(group.value).toBe('free');

    form.reset();

    expect(group.value).toBe('pro');
    expect(radios[1].checked).toBe(true);
    expect(radios[0].checked).toBe(false);
    expect(new FormData(form).get('plan')).toBe('pro');
  });

  it('clears FormData and validity when a disabled fieldset disables the group', () => {
    const { group, radios, form } = createGroup({
      attributes: { name: 'plan', value: 'pro', required: '' },
      fieldset: true,
    });

    group.formDisabledCallback(true);

    for (const radio of radios) {
      expect(radio.disabled).toBe(true);
      expect(inner(radio).disabled).toBe(true);
    }
    expect(internalsState(group)!.value).toBeNull();
    expect(internalsState(group)!.flags).toEqual({});
    expect(new FormData(form).has('plan')).toBe(false);

    group.formDisabledCallback(false);

    for (const radio of radios) {
      expect(radio.disabled).toBe(false);
    }
    expect(radios[1].checked).toBe(true);
    expect(internalsState(group)!.value).toBe('pro');
    expect(internalsState(group)!.flags).toEqual({});
    expect(new FormData(form).get('plan')).toBe('pro');
  });
});

describe('an-radio-group — keyboard', () => {
  // Measured in Chrome (CDP): two same-name native radios in *one* shadow root
  // form a real group and ArrowDown moves the selection; the same two radios in
  // *separate* shadow roots are not grouped and ArrowDown does nothing. Every
  // `<an-radio>` keeps its input in its own shadow root, so the native grouping
  // cannot apply — the group's own keydown handler below is what makes the
  // documented arrow-key behaviour real.
  it('moves and selects with the arrow keys', () => {
    const { group, radios } = createGroup({ attributes: { value: 'free' } });
    const seen: CustomEvent[] = [];
    group.addEventListener('an-radio-change', (event) => {
      seen.push(event as CustomEvent);
    });

    const event = keydown(inner(radios[0]), 'ArrowRight');

    expect(event.defaultPrevented).toBe(true);
    expect(group.value).toBe('pro');
    expect(radios[1].checked).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].detail.value).toBe('pro');
    expect(seen[0].detail.originalEvent).toBe(event);
  });

  it('wraps around at both ends', () => {
    const { group, radios } = createGroup({ attributes: { value: 'pro' } });

    keydown(inner(radios[1]), 'ArrowRight');
    expect(group.value).toBe('free');

    keydown(inner(radios[0]), 'ArrowLeft');
    expect(group.value).toBe('pro');
  });

  it('supports Home and End', () => {
    const { group, radios } = createGroup({ attributes: { value: 'pro' } });

    keydown(inner(radios[1]), 'Home');
    expect(group.value).toBe('free');

    keydown(inner(radios[0]), 'End');
    expect(group.value).toBe('pro');
  });

  it('skips disabled options while moving', () => {
    const { group, radios } = createGroup({
      values: [
        { value: 'free', text: '免费' },
        { value: 'pro', text: '专业', attributes: { disabled: '' } },
        { value: 'team', text: '团队' },
      ],
      attributes: { value: 'free' },
    });

    keydown(inner(radios[0]), 'ArrowDown');

    expect(group.value).toBe('team');
    expect(radios[2].checked).toBe(true);
    expect(radios[0].tabbable).toBe(false);
    expect(radios[2].tabbable).toBe(true);
  });

  it('does not emit again when the selected option is clicked again', () => {
    const { group, radios } = createGroup({ attributes: { value: 'free' } });
    let count = 0;
    group.addEventListener('an-radio-change', () => {
      count += 1;
    });

    radios[0].click();
    radios[0].click();

    expect(group.value).toBe('free');
    expect(count).toBe(0);
  });
});

describe('an-radio-group — parser-created markup', () => {
  it('syncs options that are parsed after the group is connected', async () => {
    document.body.innerHTML =
      '<form><an-radio-group name="plan" label="套餐">' +
      '<an-radio value="free">免费</an-radio>' +
      '<an-radio value="pro" checked>专业</an-radio>' +
      '</an-radio-group></form>';
    const form = document.querySelector('form')!;
    const group = document.querySelector('an-radio-group') as AnRadioGroup;
    await flush();

    expect(group.value).toBe('pro');
    expect(new FormData(form).get('plan')).toBe('pro');
    expect(
      (group.querySelector('an-radio[value="pro"]') as AnRadio).checked,
    ).toBe(true);
  });
});
