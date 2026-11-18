import resetStyles from './reset.css?inline';

/** Values allowed for attribute-backed properties. */
export type Primitive = string | number | boolean;

/** Defaults for attribute-backed properties; keys define the public API. */
export type Defaults = Record<string, Primitive>;

/** `my-attr` -> `myAttr`, so an attribute can drive the camelCase property. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

/** `myAttr` -> `my-attr`, so a property can reflect to the attribute. */
function toKebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/**
 * Dependency-free base class for every `x-*` custom element.
 *
 * Contract:
 * - Constructor only touches `this` (`attachShadow`, local fields, accessors):
 *   it never reads `document`, `window`, storage or the network, so importing a
 *   component stays safe under SSR and inside workers.
 * - `static defaults` declares the attribute-backed API. Property accessors are
 *   generated from it and reflect back to attributes, so `el.variant` and
 *   `variant="primary"` can never disagree; attributes stay the source of truth.
 * - Markup comes from `render()` as an HTML string and is written straight into
 *   the shadow root, including `static styles` plus the shared reset.
 * - Listeners belong on the shadow root (event delegation), because re-rendering
 *   replaces the inner markup.
 */
export abstract class XElement extends HTMLElement {
  /** Shadow-DOM stylesheet source for this element. */
  static styles: string = '';

  /** Attribute-backed properties and their defaults. */
  static defaults: Defaults = {};

  /** Attributes the browser reports to `attributeChangedCallback`. */
  static get observedAttributes(): string[] {
    return Object.keys(this.defaults).map(toKebabCase);
  }

  #defaults: Defaults = {};
  #values: Record<string, Primitive> = {};
  #rendered = false;
  #reflecting = false;
  #fallbackStyle: HTMLStyleElement | null = null;

  constructor() {
    super();
    const ctor = this.constructor as typeof XElement;
    const root = this.attachShadow({ mode: 'open' });

    this.#defaults = ctor.defaults;
    this.#values = { ...ctor.defaults };
    this.#adoptStyles(root, `${resetStyles}\n${ctor.styles}`);

    for (const [key, fallback] of Object.entries(ctor.defaults)) {
      const type = typeof fallback;
      Object.defineProperty(this, key, {
        configurable: true,
        enumerable: true,
        get: () => this.#values[key],
        set: (next: Primitive) => this.#assign(key, next, type),
      });
    }
  }

  connectedCallback(): void {
    if (this.#rendered) return;
    this.#rendered = true;
    this.requestUpdate();
  }

  /** Re-renders the shadow root from `render()`. */
  requestUpdate(): void {
    const root = this.shadowRoot;
    if (!root || !this.#rendered) return;
    root.innerHTML = this.render();
    if (this.#fallbackStyle && !this.#fallbackStyle.isConnected) root.prepend(this.#fallbackStyle);
    this.afterRender();
  }

  /** Returns the shadow-DOM markup; called on connect and after every change. */
  protected abstract render(): string;

  /** Hook for state markup cannot express (e.g. `.disabled` on a child node). */
  protected afterRender(): void {}

  /** Dispatches a bubbling, composed `CustomEvent`. */
  emit<T>(name: string, detail?: T): boolean {
    return this.dispatchEvent(new CustomEvent<T>(name, { bubbles: true, composed: true, detail }));
  }

  attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (oldValue === value) return;
    const key = toCamelCase(name);
    if (!(key in this.#defaults)) return;
    this.#values[key] = this.#coerce(key, value); // attribute -> camelCase property
    if (this.#rendered && !this.#reflecting) this.requestUpdate();
  }

  #assign(key: string, next: Primitive, type: string): void {
    const value = type === 'boolean' ? Boolean(next) : type === 'number' ? Number(next) : String(next);
    if (Object.is(this.#values[key], value)) return;
    this.#values[key] = value;
    this.#reflect(key, value);
  }

  #reflect(key: string, value: Primitive): void {
    const attribute = toKebabCase(key);
    this.#reflecting = true;
    try {
      if (typeof value === 'boolean') this.toggleAttribute(attribute, value);
      else if (value === this.#defaults[key]) this.removeAttribute(attribute);
      else this.setAttribute(attribute, String(value));
    } finally {
      this.#reflecting = false;
    }
    if (this.#rendered) this.requestUpdate();
  }

  #coerce(key: string, value: string | null): Primitive {
    const fallback = this.#defaults[key];
    if (typeof fallback === 'boolean') return value !== null;
    if (value === null) return fallback;
    if (typeof fallback === 'number') return Number.isNaN(Number(value)) ? fallback : Number(value);
    return value;
  }

  #adoptStyles(root: ShadowRoot, text: string): void {
    if (!text.trim()) return;
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      root.adoptedStyleSheets = [sheet];
    } catch {
      if (typeof document === 'undefined') return;
      const style = document.createElement('style');
      style.textContent = text;
      root.prepend(style);
      this.#fallbackStyle = style;
    }
  }
}
