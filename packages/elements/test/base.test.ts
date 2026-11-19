/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AnElement } from '../src/internal/base';

/** Minimal element that records every lifecycle hook it receives. */
class BaseProbe extends AnElement {
  static override defaults = { label: 'idle', count: 0, on: false };
  static override styles = ':host { display: block; }';

  declare label: string;
  declare count: number;
  declare on: boolean;

  connects = 0;
  disconnects = 0;
  resets = 0;
  disabledStates: boolean[] = [];

  protected render(): string {
    return `<span part="text">${this.label}</span><slot></slot>`;
  }

  protected override onConnect(): void {
    this.connects += 1;
  }

  protected override onDisconnect(): void {
    this.disconnects += 1;
  }

  protected override onFormReset(): void {
    this.resets += 1;
  }

  protected override onFormDisabled(disabled: boolean): void {
    this.disabledStates.push(disabled);
  }
}

/** Form-associated probe whose platform API is unavailable, like happy-dom. */
class FormProbe extends AnElement {
  static override formAssociated = true;
  static override defaults = { label: 'form' };

  declare label: string;

  protected render(): string {
    return `<span>${this.label}</span>`;
  }

  override attachInternals(): ElementInternals {
    throw new Error('simulated: platform has no attachInternals()');
  }
}

customElements.define('an-base-probe', BaseProbe);
customElements.define('an-form-probe', FormProbe);

type InternalsProbe = { internals: ElementInternals | null };
type LifecycleProbe = {
  formResetCallback(): void;
  formDisabledCallback(disabled: boolean): void;
  formAssociatedCallback(): void;
};

function internals(element: Element): ElementInternals | null {
  return (element as unknown as InternalsProbe).internals;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('AnElement form association', () => {
  it('leaves internals null unless the subclass opts in', () => {
    const element = document.createElement('an-base-probe');
    document.body.append(element);

    expect(internals(element)).toBeNull();
  });

  it('survives a platform without attachInternals() and degrades to null', () => {
    expect(() => document.createElement('an-form-probe')).not.toThrow();
    expect(internals(document.createElement('an-form-probe'))).toBeNull();
  });

  it('forwards formResetCallback to onFormReset', () => {
    const element = document.createElement('an-base-probe') as BaseProbe & LifecycleProbe;
    document.body.append(element);

    element.formResetCallback();
    element.formResetCallback();

    expect(element.resets).toBe(2);
  });

  it('forwards formDisabledCallback to onFormDisabled', () => {
    const element = document.createElement('an-base-probe') as BaseProbe & LifecycleProbe;
    document.body.append(element);

    element.formDisabledCallback(true);
    element.formDisabledCallback(false);

    expect(element.disabledStates).toEqual([true, false]);
  });

  it('exposes a no-op formAssociatedCallback', () => {
    const element = document.createElement('an-base-probe') as BaseProbe & LifecycleProbe;

    expect(() => element.formAssociatedCallback()).not.toThrow();
  });
});

describe('AnElement lifecycle and rendering', () => {
  it('renders synchronously on property and attribute writes', () => {
    const element = document.createElement('an-base-probe') as BaseProbe;
    document.body.append(element);
    expect(element.shadowRoot!.textContent).toBe('idle');

    element.label = 'first';
    expect(element.shadowRoot!.textContent).toBe('first');

    element.setAttribute('label', 'second');
    expect(element.shadowRoot!.textContent).toBe('second');
  });

  it('calls onConnect on every connect and onDisconnect on removal', () => {
    const element = document.createElement('an-base-probe') as BaseProbe;
    expect(element.connects).toBe(0);

    document.body.append(element);
    expect(element.connects).toBe(1);

    element.remove();
    expect(element.disconnects).toBe(1);

    document.body.append(element);
    expect(element.connects).toBe(2);
    expect(element.disconnects).toBe(1);
  });

  it('adopts the reset + component styles as a constructable stylesheet', () => {
    const element = document.createElement('an-base-probe');
    document.body.append(element);

    expect(element.shadowRoot!.adoptedStyleSheets).toHaveLength(1);
  });
});

/** Probe with a plain `name` + string `value` payload for `getFormData()`. */
class FormDataProbe extends AnElement {
  static override defaults = { name: 'field', value: 'value' };

  declare name: string;
  declare value: string;

  protected render(): string {
    return '';
  }
}

/** Probe whose value is numeric; `getFormData()` stringifies it. */
class NumberProbe extends AnElement {
  static override defaults = { name: 'count', value: 0 };

  declare name: string;
  declare value: number;

  protected render(): string {
    return '';
  }
}

/** Probe whose value is not submittable (e.g. a boolean toggle). */
class ToggleProbe extends AnElement {
  static override defaults = { name: 'toggle', value: false };

  declare name: string;
  declare value: boolean;

  protected render(): string {
    return '';
  }
}

/** Probe with a custom, multi-row payload: override `formEntries()`. */
class MultiEntryProbe extends AnElement {
  static override defaults = { name: 'tags' };

  declare name: string;
  value: string[] = [];

  protected override formEntries(): Array<[string, string | File]> {
    return this.value.map((entry) => [this.name, entry] as [string, string]);
  }

  protected render(): string {
    return '';
  }
}

/** Probe with a fake internals object, to assert the validity forwarding. */
class ValidityProbe extends AnElement {
  static override formAssociated = true;
  static override defaults = { valid: true };

  declare valid: boolean;

  override attachInternals(): ElementInternals {
    return {
      checkValidity: () => this.valid,
      reportValidity: () => this.valid,
    } as unknown as ElementInternals;
  }

  protected render(): string {
    return '';
  }
}

/** Probe whose reset hook changes markup only `reset()` can re-render. */
class ResetProbe extends AnElement {
  #state = 'initial';

  protected override render(): string {
    return `<span>${this.#state}</span>`;
  }

  protected override onFormReset(): void {
    this.#state = 'reset';
  }
}

/** Probe with a comma-separated array attribute. */
class ListProbe extends AnElement {
  static override arrayDefaults = { tags: ['a', 'b'] };

  declare tags: string[];

  protected override render(): string {
    return this.tags.join('|');
  }
}

customElements.define('an-form-data-probe', FormDataProbe);
customElements.define('an-number-probe', NumberProbe);
customElements.define('an-toggle-probe', ToggleProbe);
customElements.define('an-multi-entry-probe', MultiEntryProbe);
customElements.define('an-validity-probe', ValidityProbe);
customElements.define('an-reset-probe', ResetProbe);
customElements.define('an-list-probe', ListProbe);

describe('AnElement form helpers', () => {
  it('reports validity as true without internals', () => {
    const element = document.createElement('an-base-probe') as BaseProbe;

    expect(element.checkValidity()).toBe(true);
    expect(element.reportValidity()).toBe(true);
  });

  it('forwards validity calls to the platform internals', () => {
    const element = document.createElement('an-validity-probe') as ValidityProbe;

    expect(element.checkValidity()).toBe(true);
    expect(element.reportValidity()).toBe(true);

    element.valid = false;
    expect(element.checkValidity()).toBe(false);
    expect(element.reportValidity()).toBe(false);
  });

  it('reset() goes through formResetCallback -> onFormReset and re-renders', () => {
    const element = document.createElement('an-reset-probe') as ResetProbe;
    document.body.append(element);
    expect(element.shadowRoot!.textContent).toBe('initial');

    element.reset();
    expect(element.shadowRoot!.textContent).toBe('reset');
  });
});

describe('AnElement getFormData', () => {
  it('serializes the name + value pair', () => {
    const element = document.createElement('an-form-data-probe') as FormDataProbe;

    expect(element.getFormData()?.get('field')).toBe('value');

    element.value = 'updated';
    expect(element.getFormData()?.get('field')).toBe('updated');
  });

  it('stringifies a numeric value', () => {
    const element = document.createElement('an-number-probe') as NumberProbe;

    expect(element.getFormData()?.get('count')).toBe('0');

    element.value = 42;
    expect(element.getFormData()?.get('count')).toBe('42');
  });

  it('returns null without a name', () => {
    const element = document.createElement('an-form-data-probe') as FormDataProbe;
    element.name = '';

    expect(element.getFormData()).toBeNull();
  });

  it('returns null when the value is not a string or a number', () => {
    const element = document.createElement('an-toggle-probe') as ToggleProbe;

    expect(element.getFormData()).toBeNull();
  });

  it('appends every row returned by formEntries()', () => {
    const element = document.createElement('an-multi-entry-probe') as MultiEntryProbe;
    element.value = ['a', 'b'];

    const data = element.getFormData();
    expect(data?.getAll('tags')).toEqual(['a', 'b']);
  });

  it('returns null when formEntries() is empty', () => {
    const element = document.createElement('an-multi-entry-probe') as MultiEntryProbe;

    expect(element.getFormData()).toBeNull();
  });
});

describe('AnElement array attributes', () => {
  it('starts from the declared default list', () => {
    const element = document.createElement('an-list-probe') as ListProbe;

    expect(element.tags).toEqual(['a', 'b']);
  });

  it('reads a comma-separated attribute into the array property', () => {
    const element = document.createElement('an-list-probe') as ListProbe;
    document.body.append(element);

    element.setAttribute('tags', 'x, y,z');
    expect(element.tags).toEqual(['x', 'y', 'z']);
    expect(element.shadowRoot!.textContent).toBe('x|y|z');
  });

  it('reflects a property write back to the attribute and back to the default', () => {
    const element = document.createElement('an-list-probe') as ListProbe;

    element.tags = ['p', 'q'];
    expect(element.getAttribute('tags')).toBe('p,q');

    element.tags = ['a', 'b'];
    expect(element.hasAttribute('tags')).toBe(false);
  });

  it('returns a copy so mutating the getter result does not change state', () => {
    const element = document.createElement('an-list-probe') as ListProbe;

    element.tags.push('c');
    expect(element.tags).toEqual(['a', 'b']);
  });

  it('leaves elements without arrayDefaults unchanged', () => {
    const element = document.createElement('an-base-probe');

    expect('tags' in element).toBe(false);
  });
});
