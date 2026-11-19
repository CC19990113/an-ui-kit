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
 * Dependency-free base class for every `an-*` custom element.
 *
 * Contract:
 * - Constructor only touches `this` (`attachShadow`, `attachInternals`, local
 *   fields, accessors): it never reads `document`, `window`, storage or the
 *   network, so importing a component stays safe under SSR and inside workers.
 * - `static defaults` declares the attribute-backed API. Property accessors are
 *   generated from it and reflect back to attributes, so `el.variant` and
 *   `variant="primary"` can never disagree; attributes stay the source of truth.
 * - Markup comes from `render()` as an HTML string and is written straight into
 *   the shadow root, including `static styles` plus the shared reset.
 * - Listeners belong on the shadow root (event delegation), because re-rendering
 *   replaces the inner markup.
 * - Every write re-renders before it returns, so `el.disabled = true` followed by
 *   a synchronous `shadowRoot` read already sees the new markup.
 * - Form participation is opt-in: a subclass sets `static formAssociated = true`
 *   and then gets `this.internals`, the platform lifecycle callbacks
 *   (`formAssociatedCallback`, `formResetCallback`, `formDisabledCallback`) and
 *   the protected `onFormReset` / `onFormDisabled` hooks.
 */
export abstract class AnElement extends HTMLElement {
  /** Shadow-DOM stylesheet source for this element. */
  static styles: string = '';

  /** Attribute-backed properties and their defaults. */
  static defaults: Defaults = {};

  /** Attributes the browser reports to `attributeChangedCallback`. */
  static get observedAttributes(): string[] {
    return Object.keys(this.defaults).map(toKebabCase);
  }

  /**
   * Opts the element into `ElementInternals` form participation.
   * Subclasses that submit/reset/validate through a form set this to `true`.
   */
  static formAssociated: boolean = false;

  /**
   * Platform form internals, attached only when `static formAssociated` is
   * `true`. `null` on elements that did not opt in and on DOM implementations
   * without `attachInternals()`.
   */
  protected internals: ElementInternals | null = null;

  #defaults: Defaults = {};
  #values: Record<string, Primitive> = {};
  #rendered = false;
  #reflecting = false;
  #fallbackStyle: HTMLStyleElement | null = null;

  constructor() {
    super();
    const ctor = this.constructor as typeof AnElement;
    const root = this.attachShadow({ mode: 'open' });

    if (ctor.formAssociated) {
      try {
        this.internals = this.attachInternals();
      } catch {
        // `attachInternals()` throws unless the element opted in, and some DOM
        // implementations (e.g. happy-dom) do not expose it at all: degrade to a
        // plain element instead of failing construction.
        this.internals = null;
      }
    }

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
    if (!this.#rendered) {
      this.#rendered = true;
      this.requestUpdate();
    }
    this.onConnect();
  }

  /** Re-renders the shadow root from `render()`. */
  requestUpdate(): void {
    const root = this.shadowRoot;
    if (!root || !this.#rendered) return;
    root.innerHTML = this.render();
    if (this.#fallbackStyle && !this.#fallbackStyle.isConnected) root.prepend(this.#fallbackStyle);
    this.afterRender();
  }

  disconnectedCallback(): void {
    this.onDisconnect();
  }

  /**
   * Platform callback: the element was associated with, or disassociated from,
   * a form. Association itself is opt-in, so the default implementation is a
   * no-op; a subclass may read `this.internals?.form` here.
   */
  formAssociatedCallback(): void {}

  /** Platform callback: the owning form was reset. */
  formResetCallback(): void {
    this.onFormReset();
  }

  /** Platform callback: the platform disabled or enabled the element. */
  formDisabledCallback(disabled: boolean): void {
    this.onFormDisabled(disabled);
  }

  /** Hook: connected and rendered; default no-op. */
  protected onConnect(): void {}

  /** Hook: disconnected from the document; default no-op. */
  protected onDisconnect(): void {}

  /** Hook: the owning form was reset; restore state here. Default no-op. */
  protected onFormReset(): void {}

  /** Hook: the platform-level disabled state changed; default no-op. */
  protected onFormDisabled(disabled: boolean): void {}

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
