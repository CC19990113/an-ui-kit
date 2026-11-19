/** @vitest-environment happy-dom */
// The shim has to be installed before the element's constructor calls
// `attachInternals()`, so that call finds it. Static imports are evaluated in
// source order.
import './helpers/form-internals';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AnNumber,
  STEP_HOLD_DELAY,
  STEP_REPEAT_INTERVAL,
  type AnNumberChangeDetail,
} from '../src/number/an-number';
import numberCssSource from '../src/number/an-number.css?inline';
import { internalsState } from './helpers/form-internals';
import { componentSuite } from './helpers/harness';

// `<an-number>` is not exported by `src/index.ts`, so the test file owns its
// registration; the guard keeps a repeated import from throwing.
if (!customElements.get('an-number')) customElements.define('an-number', AnNumber);

const CSS_VARS = [
  '--an-number-height',
  '--an-number-bg',
  '--an-number-fg',
  '--an-number-border-color',
  '--an-number-radius',
  '--an-number-font-size',
  '--an-number-padding-x',
  '--an-number-focus-ring',
  '--an-number-stepper-width',
];

const RESET_PROPERTIES = ['box-sizing', 'border', 'margin', 'line-height'];

componentSuite({
  tag: 'an-number',
  ctor: AnNumber,
  defaults: AnNumber.defaults,
  events: ['an-number-change'],
  cssVars: CSS_VARS,
  parts: ['base', 'input'],
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function mount(attributes: Record<string, string> = {}): AnNumber {
  const element = document.createElement('an-number') as AnNumber;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
}

function inner(element: AnNumber): HTMLInputElement {
  return element.shadowRoot!.querySelector('input')!;
}

function stepperButton(element: AnNumber, direction: 'up' | 'down'): HTMLButtonElement {
  return element.shadowRoot!.querySelector(`[part="spin-${direction}"]`) as HTMLButtonElement;
}

/** Types into the internal input exactly as a user would, without committing. */
function type(element: AnNumber, text: string): void {
  const input = inner(element);
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Commits the draft the way a blur does. */
function commit(element: AnNumber): void {
  inner(element).dispatchEvent(new Event('focusout', { bubbles: true }));
}

function press(element: AnNumber, key: string, init: KeyboardEventInit = {}): void {
  inner(element).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

function changes(element: AnNumber): CustomEvent<AnNumberChangeDetail>[] {
  const events: CustomEvent<AnNumberChangeDetail>[] = [];
  element.addEventListener('an-number-change', (event) => {
    events.push(event as CustomEvent<AnNumberChangeDetail>);
  });
  return events;
}

/** The stylesheet text the shadow root actually carries (adopted or fallback). */
function adoptedStyles(element: AnNumber): string {
  const inline = element.shadowRoot!.querySelector('style')?.textContent ?? '';
  if (inline) return inline;
  return element.shadowRoot!.adoptedStyleSheets
    .map((sheet) => Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n'))
    .join('\n');
}

describe('an-number — rendering', () => {
  it('renders a text spinbutton with decimal input mode and the base parts', () => {
    const element = mount();
    const input = inner(element);

    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(input.getAttribute('role')).toBe('spinbutton');
    expect(element.shadowRoot!.querySelector('[part="base"]')).not.toBeNull();
    expect(element.shadowRoot!.querySelector('[part="input"]')).toBe(input);
  });

  it('renders the stepper parts only when `stepper` is set', () => {
    const bare = mount();
    expect(bare.shadowRoot!.querySelector('[part="stepper"]')).toBeNull();
    expect(bare.shadowRoot!.querySelector('[part="spin-up"]')).toBeNull();
    expect(bare.shadowRoot!.querySelector('[part="spin-down"]')).toBeNull();

    const stepper = mount({ stepper: '' });
    expect(stepper.shadowRoot!.querySelector('[part="stepper"]')).not.toBeNull();
    expect(stepperButton(stepper, 'up').getAttribute('part')).toBe('spin-up');
    expect(stepperButton(stepper, 'down').getAttribute('part')).toBe('spin-down');
    expect(stepperButton(stepper, 'up').getAttribute('aria-label')).toBe('增加');
    expect(stepperButton(stepper, 'down').getAttribute('aria-label')).toBe('减少');
  });

  it('reflects the size scale through the real cascade', () => {
    const height = (element: AnNumber): number => parseFloat(getComputedStyle(inner(element)).height);

    const small = mount({ size: 'sm' });
    const medium = mount({ size: 'md' });
    const large = mount({ size: 'lg' });

    expect(height(small)).toBeLessThan(height(medium));
    expect(height(medium)).toBeLessThan(height(large));
  });

  it('keeps one input and the value across attribute changes', () => {
    const element = mount({ value: 'keep' });
    expect(element.value).toBeNull();

    const before = inner(element);
    element.setAttribute('size', 'lg');
    element.setAttribute('stepper', '');
    element.setAttribute('placeholder', 'q');
    expect(element.shadowRoot!.querySelectorAll('input')).toHaveLength(1);
    expect(inner(element).value).toBe('keep');
    expect(inner(element)).not.toBe(before);
  });

  it('adopts the shared :host reset and both theme entries', () => {
    const element = mount();
    const styles = adoptedStyles(element);

    for (const property of RESET_PROPERTIES) expect(styles, property).toContain(`${property}:`);
    expect(numberCssSource).toContain(":host([data-theme='dark'])");
    expect(numberCssSource).toContain(":host([data-theme='light'])");
    expect(numberCssSource).toContain("color-scheme: light dark");
  });

  it('escapes injected markup in placeholder and forwarded ARIA labels', () => {
    const element = mount({ placeholder: 'a"b', 'aria-label': '<b>Qty</b>' });
    const input = inner(element);

    expect(input.getAttribute('placeholder')).toBe('a"b');
    expect(input.getAttribute('aria-label')).toBe('<b>Qty</b>');
    expect(element.shadowRoot!.querySelector('b')).toBeNull();
  });

  it('forwards aria-labelledby from the host to the input', () => {
    const element = mount({ 'aria-labelledby': 'amount-label' });
    expect(inner(element).getAttribute('aria-labelledby')).toBe('amount-label');
  });
});

describe('an-number — typing and normalisation', () => {
  it('seeds the value from the attribute and never writes it back', () => {
    const element = mount({ value: '5' });
    expect(element.value).toBe(5);
    expect(inner(element).value).toBe('5');

    type(element, '7');
    commit(element);
    expect(element.value).toBe(7);
    expect(inner(element).value).toBe('7');
    expect(element.getAttribute('value')).toBe('5');
  });

  it('starts empty and reports a null value', () => {
    const element = mount();
    expect(element.value).toBeNull();
    expect(inner(element).value).toBe('');
    expect(element.hasAttribute('value')).toBe(false);
  });

  it('keeps intermediate drafts verbatim while typing', () => {
    const element = mount({ value: '1.2' });

    type(element, '-');
    expect(inner(element).value).toBe('-');
    expect(element.value).toBeNull();

    type(element, '1.');
    expect(inner(element).value).toBe('1.');
    expect(element.value).toBe(1);

    type(element, '.5');
    expect(inner(element).value).toBe('.5');
    expect(element.value).toBe(0.5);

    type(element, '1.20');
    expect(inner(element).value).toBe('1.20');
    expect(element.value).toBe(1.2);
  });

  it('normalises "1." and ".5" on commit', () => {
    const element = mount();

    type(element, '1.');
    commit(element);
    expect(inner(element).value).toBe('1');

    type(element, '.5');
    commit(element);
    expect(inner(element).value).toBe('0.5');
  });

  it('drops trailing zeros and rounds through precision', () => {
    const precise = mount({ precision: '2' });

    type(precise, '1.005');
    commit(precise);
    expect(inner(precise).value).toBe('1.01');

    type(precise, '2.500');
    commit(precise);
    expect(inner(precise).value).toBe('2.5');

    const whole = mount({ precision: '0' });
    type(whole, '1.6');
    commit(whole);
    expect(inner(whole).value).toBe('2');
  });

  it('clamps to min and max on commit', () => {
    const element = mount({ min: '0', max: '10' });

    type(element, '99');
    commit(element);
    expect(inner(element).value).toBe('10');
    expect(element.value).toBe(10);

    type(element, '-5');
    commit(element);
    expect(inner(element).value).toBe('0');
    expect(element.value).toBe(0);
  });

  it('clamps an out-of-range mount value on commit', () => {
    const element = mount({ value: '99', max: '5' });
    expect(element.value).toBe(99);

    commit(element);
    expect(inner(element).value).toBe('5');
    expect(element.value).toBe(5);
  });

  it('leaves unparseable text alone on commit', () => {
    const element = mount();
    type(element, 'abc');
    commit(element);

    expect(inner(element).value).toBe('abc');
    expect(element.value).toBeNull();
    expect(internalsState(element)!.flags).toMatchObject({ badInput: true });
  });
});

describe('an-number — stepping', () => {
  it('steps by one by default', () => {
    const element = mount({ value: '5' });

    element.stepUp();
    expect(element.value).toBe(6);

    element.stepDown(2);
    expect(element.value).toBe(4);
  });

  it('steps up from the step base when empty', () => {
    const element = mount();
    expect(element.value).toBeNull();

    element.stepUp();
    expect(element.value).toBe(1);

    const bounded = mount({ min: '5' });
    bounded.stepUp();
    expect(bounded.value).toBe(6);
  });

  it('uses the configured step', () => {
    const element = mount({ value: '2', step: '2' });

    element.stepUp();
    expect(element.value).toBe(4);

    element.stepDown(2);
    expect(element.value).toBe(0);
  });

  it('snaps an off-grid value onto the min-based grid', () => {
    const element = mount({ value: '2', min: '1', step: '2' });

    element.stepUp();
    expect(element.value).toBe(3);

    element.stepUp();
    expect(element.value).toBe(5);

    element.stepDown();
    expect(element.value).toBe(3);
  });

  it('clamps at the bounds and does not overshoot', () => {
    const element = mount({ value: '9', max: '10' });

    element.stepUp();
    expect(element.value).toBe(10);

    element.stepUp();
    expect(element.value).toBe(10);

    const low = mount({ value: '0', min: '0' });
    low.stepDown();
    expect(low.value).toBe(0);
  });
});

describe('an-number — events', () => {
  it('stays silent while typing and emits once the commit changes the value', () => {
    const element = mount({ value: '5' });
    const events = changes(element);

    type(element, '6');
    expect(events).toHaveLength(0);

    commit(element);
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.value).toBe(6);

    commit(element);
    expect(events).toHaveLength(1);

    type(element, '6.0');
    commit(element);
    expect(events).toHaveLength(1);
  });

  it('emits null when the field is cleared', () => {
    const element = mount({ value: '5' });
    const events = changes(element);

    type(element, '');
    commit(element);

    expect(events).toHaveLength(1);
    expect(events[0]!.detail.value).toBeNull();
  });

  it('carries the triggering event and bubbles', () => {
    const element = mount({ value: '1' });
    const events = changes(element);
    const blur = new Event('focusout', { bubbles: true });

    type(element, '2');
    inner(element).dispatchEvent(blur);

    expect(events).toHaveLength(1);
    expect(events[0]!.detail.originalEvent).toBe(blur);
    expect(events[0]!.bubbles).toBe(true);
    expect(events[0]!.composed).toBe(true);
  });

  it('steps emit a change only while the value moves', () => {
    const element = mount({ max: '1' });
    const events = changes(element);

    element.stepUp();
    expect(events).toHaveLength(1);
    expect(events[0]!.detail.value).toBe(1);

    element.stepUp();
    expect(events).toHaveLength(1);
  });

  it('setting the value property never emits', () => {
    const element = mount();
    const events = changes(element);

    element.value = 7;
    expect(element.value).toBe(7);
    expect(inner(element).value).toBe('7');

    element.value = null;
    expect(element.value).toBeNull();
    expect(inner(element).value).toBe('');
    expect(events).toHaveLength(0);
  });
});

describe('an-number — value assignment', () => {
  it('accepts numeric strings from framework templates', () => {
    const element = mount();
    const events = changes(element);

    element.value = '3';
    expect(element.value).toBe(3);
    expect(inner(element).value).toBe('3');

    element.value = ' 3.5 ';
    expect(element.value).toBe(3.5);
    expect(inner(element).value).toBe('3.5');

    expect(events).toHaveLength(0);
  });

  it('keeps numeric zero', () => {
    const element = mount({ value: '5' });

    element.value = 0;
    expect(element.value).toBe(0);
    expect(inner(element).value).toBe('0');
  });

  it('clears blank, non-numeric and non-finite assignments without throwing', () => {
    const element = mount({ value: '9' });
    const cases = ['', '   ', 'abc', 'Infinity', null, undefined, Number.NaN] as const;

    for (const next of cases) {
      (element as unknown as { value: unknown }).value = next;
      expect(element.value, String(next)).toBeNull();
      expect(inner(element).value, String(next)).toBe('');
    }
  });
});

describe('an-number — keyboard', () => {
  it('steps with ArrowUp and ArrowDown', () => {
    const element = mount({ value: '1' });

    press(element, 'ArrowUp');
    expect(element.value).toBe(2);

    press(element, 'ArrowDown');
    expect(element.value).toBe(1);
  });

  it('steps by 10x with Shift held', () => {
    const element = mount({ value: '1' });
    press(element, 'ArrowUp', { shiftKey: true });
    expect(element.value).toBe(11);

    press(element, 'ArrowDown', { shiftKey: true });
    expect(element.value).toBe(1);
  });

  it('steps by 10x with PageUp and PageDown', () => {
    const element = mount({ value: '5' });

    press(element, 'PageUp');
    expect(element.value).toBe(15);

    press(element, 'PageDown');
    expect(element.value).toBe(5);
  });

  it('jumps to min with Home and to max with End', () => {
    const element = mount({ value: '50', min: '0', max: '100' });

    press(element, 'Home');
    expect(element.value).toBe(0);

    press(element, 'End');
    expect(element.value).toBe(100);
  });

  it('ignores Home and End when there is no bound', () => {
    const element = mount({ value: '50' });

    press(element, 'Home');
    expect(element.value).toBe(50);

    press(element, 'End');
    expect(element.value).toBe(50);
  });

  it('normalises the draft on Enter', () => {
    const element = mount();
    type(element, '1.20');

    press(element, 'Enter');
    expect(inner(element).value).toBe('1.2');
  });

  it('ignores stepper keys while readonly', () => {
    const element = mount({ value: '5', readonly: '' });

    press(element, 'ArrowUp');
    expect(element.value).toBe(5);
  });
});

describe('an-number — stepper', () => {
  it('steps with the buttons', () => {
    const element = mount({ stepper: '' });

    stepperButton(element, 'up').click();
    expect(element.value).toBe(1);

    stepperButton(element, 'up').click();
    expect(element.value).toBe(2);

    stepperButton(element, 'down').click();
    expect(element.value).toBe(1);
  });

  it('disables the buttons while the field is disabled or readonly', () => {
    const disabled = mount({ stepper: '', disabled: '' });
    expect(stepperButton(disabled, 'up').disabled).toBe(true);
    stepperButton(disabled, 'up').click();
    expect(disabled.value).toBeNull();

    const readonly = mount({ stepper: '', readonly: '' });
    expect(stepperButton(readonly, 'up').disabled).toBe(true);
  });

  it('repeats while a button is held and stops on pointerup', () => {
    vi.useFakeTimers();
    try {
      const element = mount({ stepper: '' });
      stepperButton(element, 'up').dispatchEvent(new Event('pointerdown', { bubbles: true }));
      expect(element.value).toBe(1);

      vi.advanceTimersByTime(STEP_HOLD_DELAY);
      vi.advanceTimersByTime(STEP_REPEAT_INTERVAL);
      expect(element.value).toBe(2);

      vi.advanceTimersByTime(STEP_REPEAT_INTERVAL);
      expect(element.value).toBe(3);

      document.dispatchEvent(new Event('pointerup'));
      vi.advanceTimersByTime(STEP_REPEAT_INTERVAL * 3);
      expect(element.value).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('an-number — form and validation', () => {
  it('submits the normalised string', () => {
    document.body.innerHTML = '<form><an-number name="q" value="1.50"></an-number></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-number') as AnNumber;

    expect(element.value).toBe(1.5);
    expect(new FormData(form).get('q')).toBe('1.5');
  });

  it('submits an empty string for an empty field', () => {
    document.body.innerHTML = '<form><an-number name="q"></an-number></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-number') as AnNumber;

    expect(new FormData(form).get('q')).toBe('');
    expect(element.getFormData()!.get('q')).toBe('');
  });

  it('drops disabled entries from FormData and from validation', () => {
    document.body.innerHTML = '<form><an-number name="q" value="3" disabled></an-number></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-number') as AnNumber;

    expect(new FormData(form).has('q')).toBe(false);
    expect(element.getFormData()).toBeNull();
    expect(internalsState(element)!.flags).toEqual({});
  });

  it('keeps readonly entries but bars them from validation', () => {
    document.body.innerHTML =
      '<form><an-number name="q" required readonly></an-number></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-number') as AnNumber;
    const submits: Event[] = [];
    const invalids: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });
    element.addEventListener('invalid', (event) => invalids.push(event));

    expect(new FormData(form).get('q')).toBe('');
    expect(internalsState(element)!.flags).toEqual({});
    form.requestSubmit();
    expect(invalids).toHaveLength(0);
    expect(submits).toHaveLength(1);
  });

  it('blocks submit with valueMissing while required and empty', () => {
    document.body.innerHTML = '<form><an-number name="q" required></an-number></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-number') as AnNumber;
    const submits: Event[] = [];
    const invalids: Event[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });
    element.addEventListener('invalid', (event) => invalids.push(event));

    expect(internalsState(element)!.flags).toMatchObject({ valueMissing: true });
    expect(internalsState(element)!.message).toBe('此字段为必填项。');
    form.requestSubmit();
    expect(invalids).toHaveLength(1);
    expect(submits).toHaveLength(0);
  });

  it('clears valueMissing once a value is typed', () => {
    document.body.innerHTML = '<form><an-number name="q" required></an-number></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-number') as AnNumber;

    type(element, '2');
    expect(internalsState(element)!.flags).toEqual({});
    expect(new FormData(form).get('q')).toBe('2');
  });

  it('flags badInput with a Chinese message', () => {
    const element = mount();

    type(element, 'nope');
    expect(internalsState(element)!.flags).toMatchObject({ badInput: true });
    expect(internalsState(element)!.message).toBe('请输入有效的数字。');
  });

  it('flags rangeUnderflow and clamps on commit', () => {
    const element = mount({ value: '5', min: '10' });

    expect(internalsState(element)!.flags).toMatchObject({ rangeUnderflow: true });
    expect(internalsState(element)!.message).toBe('数值不能小于 10。');

    commit(element);
    expect(element.value).toBe(10);
    expect(internalsState(element)!.flags).toEqual({});
  });

  it('flags rangeOverflow and clamps on commit', () => {
    const element = mount({ value: '20', max: '10' });

    expect(internalsState(element)!.flags).toMatchObject({ rangeOverflow: true });
    expect(internalsState(element)!.message).toBe('数值不能大于 10。');

    commit(element);
    expect(element.value).toBe(10);
    expect(internalsState(element)!.flags).toEqual({});
  });

  it('flags stepMismatch relative to min', () => {
    const element = mount({ min: '1', step: '2' });
    type(element, '2');

    expect(internalsState(element)!.flags).toMatchObject({ stepMismatch: true });
    expect(internalsState(element)!.message).toBe('数值必须符合步长 2。');

    type(element, '3');
    expect(internalsState(element)!.flags).toEqual({});
  });

  it('flags stepMismatch relative to zero without min', () => {
    const element = mount({ step: '2' });
    type(element, '3');
    expect(internalsState(element)!.flags).toMatchObject({ stepMismatch: true });

    type(element, '4');
    expect(internalsState(element)!.flags).toEqual({});
  });

  it('restores the mount-time value on form reset', () => {
    document.body.innerHTML = '<form><an-number name="q" value="3"></an-number></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-number') as AnNumber;

    type(element, '7');
    commit(element);
    expect(element.value).toBe(7);

    form.reset();
    expect(element.value).toBe(3);
    expect(inner(element).value).toBe('3');
    expect(new FormData(form).get('q')).toBe('3');
  });

  it('discards an uncommitted draft on form reset', () => {
    document.body.innerHTML = '<form><an-number name="q" value="3" required></an-number></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-number') as AnNumber;

    type(element, '');
    expect(internalsState(element)!.flags).toMatchObject({ valueMissing: true });

    form.reset();
    expect(inner(element).value).toBe('3');
    expect(internalsState(element)!.flags).toEqual({});
  });

  it('follows a disabled fieldset through formDisabledCallback', () => {
    document.body.innerHTML =
      '<form><fieldset><an-number name="q" value="4"></an-number></fieldset></form>';
    const form = document.querySelector('form')!;
    const element = document.querySelector('an-number') as AnNumber;

    element.formDisabledCallback(true);
    expect(new FormData(form).has('q')).toBe(false);
    expect(internalsState(element)!.flags).toEqual({});
    type(element, '9');
    expect(element.value).toBe(4);

    element.formDisabledCallback(false);
    expect(new FormData(form).get('q')).toBe('4');
  });

  it('reflects required, disabled and readonly through the ARIA surface', () => {
    const required = mount({ required: '' });
    expect(required.getAttribute('aria-required')).toBe('true');
    expect(inner(required).required).toBe(true);

    const disabled = mount({ disabled: '' });
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    expect(inner(disabled).disabled).toBe(true);

    const readonly = mount({ readonly: '' });
    expect(readonly.getAttribute('aria-readonly')).toBe('true');
    expect(inner(readonly).readOnly).toBe(true);
  });

  it('tracks the draft through aria-valuenow, aria-valuemin, aria-valuemax and aria-valuetext', () => {
    const element = mount({ value: '2.5', min: '0', max: '10' });
    let input = inner(element);

    expect(input.getAttribute('aria-valuenow')).toBe('2.5');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('10');
    expect(input.getAttribute('aria-valuetext')).toBe('2.5');

    type(element, '3.5');
    input = inner(element);
    expect(input.getAttribute('aria-valuenow')).toBe('3.5');
    expect(input.getAttribute('aria-valuetext')).toBe('3.5');

    type(element, '-');
    input = inner(element);
    expect(input.hasAttribute('aria-valuenow')).toBe(false);
    expect(input.getAttribute('aria-valuetext')).toBe('-');
  });

  it('exposes the platform validation message and validity', () => {
    const element = mount({ required: '' });

    expect(element.validationMessage).toBe('此字段为必填项。');
    expect(element.validity?.valueMissing).toBe(true);
  });

  it('serialises getFormData only when a name is set', () => {
    const named = mount({ name: 'q', value: '2' });
    expect(named.getFormData()!.get('q')).toBe('2');

    const anonymous = mount({ value: '2' });
    expect(anonymous.getFormData()).toBeNull();
  });

  it('ignores typing while disabled or readonly', () => {
    const disabled = mount({ disabled: '' });
    type(disabled, '5');
    commit(disabled);
    expect(disabled.value).toBeNull();

    const readonly = mount({ readonly: '', value: '5' });
    type(readonly, '9');
    commit(readonly);
    // A native read-only input would never have accepted the edit; the model stays put.
    expect(readonly.value).toBe(5);
  });
});
