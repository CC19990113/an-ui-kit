/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from 'vitest';

/**
 * The public contract an element must satisfy, expressed as data.
 *
 * `componentSuite` turns this into the boilerplate assertions every component
 * repeats: registration, defaults, attribute <-> property reflection, shadow
 * parts, CSS hooks and the event wiring.
 */
export interface ComponentSpec {
  /** Tag name the element registers under, e.g. `an-button`. */
  tag: string;
  /** The registered constructor. */
  ctor: CustomElementConstructor;
  /** Documented defaults: property name -> default value. */
  defaults: Record<string, unknown>;
  /** Documented events; each must be a bubbling, composed `CustomEvent`. */
  events?: string[];
  /** Documented CSS custom properties; each must appear in `ctor.styles`. */
  cssVars?: string[];
  /** Shadow parts that must exist after the first render. */
  parts?: string[];
}

/** `myAttr` -> `my-attr`, mirroring the base class' attribute naming. */
function toKebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/** A value that is guaranteed not to equal the default. */
function sampleFor(fallback: unknown): string | number {
  if (typeof fallback === 'number') return fallback + 1;
  return fallback ? `${String(fallback)}-alt` : 'sample';
}

/** Element instance with its generated accessors addressable by name. */
type Probe = HTMLElement & Record<string, unknown>;

function mount(spec: ComponentSpec): HTMLElement {
  const element = document.createElement(spec.tag);
  document.body.append(element);
  return element;
}

/**
 * Registers the shared contract tests for one component.
 *
 * Behaviour unique to the component belongs in its own test file; everything
 * that only restates the `AnElement` contract stays here.
 */
export function componentSuite(spec: ComponentSpec): void {
  const { tag, ctor, defaults, events = [], cssVars = [], parts = [] } = spec;
  const properties = Object.keys(defaults);

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe(`${tag} — shared contract`, () => {
    it('registers the tag exactly once and upgrades created elements', () => {
      expect(customElements.get(tag)).toBe(ctor);
      expect(mount(spec)).toBeInstanceOf(ctor);
    });

    it('starts every documented property at its default without markup', () => {
      const element = mount(spec) as Probe;
      for (const property of properties) {
        expect(element[property], property).toEqual(defaults[property]);
        expect(element.hasAttribute(toKebabCase(property)), property).toBe(false);
      }
    });

    it('maps every documented attribute onto its camelCase property', () => {
      for (const property of properties) {
        const element = mount(spec) as Probe;
        const attribute = toKebabCase(property);
        const fallback = defaults[property];

        if (typeof fallback === 'boolean') {
          element.setAttribute(attribute, '');
          expect(element[property], property).toBe(true);
          element.removeAttribute(attribute);
          expect(element[property], property).toBe(false);
        } else {
          const value = sampleFor(fallback);
          element.setAttribute(attribute, String(value));
          expect(element[property], property).toBe(value);
        }
      }
    });

    it('reflects every documented property back onto its attribute', () => {
      for (const property of properties) {
        const element = mount(spec) as Probe;
        const attribute = toKebabCase(property);
        const fallback = defaults[property];

        if (typeof fallback === 'boolean') {
          element[property] = true;
          expect(element.hasAttribute(attribute), property).toBe(true);
          element[property] = false;
          expect(element.hasAttribute(attribute), property).toBe(false);
        } else {
          const value = sampleFor(fallback);
          element[property] = value;
          expect(element.getAttribute(attribute), property).toBe(String(value));
        }
      }
    });

    it('renders every documented part into the shadow root', () => {
      const element = mount(spec);
      for (const part of parts) {
        expect(element.shadowRoot?.querySelector(`[part~="${part}"]`), part).not.toBeNull();
      }
    });

    it('uses every documented CSS custom property in its stylesheet', () => {
      const { styles = '' } = ctor as unknown as { styles?: string };
      expect(typeof styles).toBe('string');
      for (const property of cssVars) {
        expect(styles, property).toContain(property);
      }
    });

    it('wires every documented event as a bubbling, composed CustomEvent', () => {
      for (const name of events) {
        const element = mount(spec) as unknown as {
          emit(event: string, detail?: unknown): boolean;
        };
        const seen: CustomEvent[] = [];
        const listener = (event: Event): void => {
          seen.push(event as CustomEvent);
        };
        document.addEventListener(name, listener);
        try {
          element.emit(name, {});
        } finally {
          document.removeEventListener(name, listener);
        }

        expect(seen, name).toHaveLength(1);
        expect(seen[0]).toBeInstanceOf(CustomEvent);
        expect(seen[0].bubbles, name).toBe(true);
        expect(seen[0].composed, name).toBe(true);
      }
    });
  });
}
