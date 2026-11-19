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
