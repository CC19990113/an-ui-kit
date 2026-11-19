import resetStyles from './reset.css?inline';

/** Values allowed for attribute-backed properties. */
export type Primitive = string | number | boolean;

/** Defaults for attribute-backed properties; keys define the public API. */
export type Defaults = Record<string, Primitive>;

/** Defaults for list properties; an attribute holds the items comma-separated. */
export type ArrayDefaults = Record<string, string[]>;

/** `my-attr` -> `myAttr`, so an attribute can drive the camelCase property. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

/** `myAttr` -> `my-attr`, so a property can reflect to the attribute. */
function toKebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/** `"a, b"` -> `['a', 'b']`; an absent attribute restores the fallback list. */
function toList(value: string | null, fallback: readonly string[]): string[] {
  if (value === null) return [...fallback];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Order-sensitive comparison, used to skip redundant writes and renders. */
function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((part, index) => part === b[index]);
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
 * - `static arrayDefaults` opts an attribute into a comma-separated `string[]`
 *   property. Elements that do not declare it keep a scalar-only API.
 * - `checkValidity()` / `reportValidity()` / `reset()` / `getFormData()` wrap the
 *   platform form surface so a subclass does not repeat it.
 */
export abstract class AnElement extends HTMLElement {
  /** Shadow-DOM stylesheet source for this element. */
  static styles: string = '';

  /** Attribute-backed properties and their defaults. */
  static defaults: Defaults = {};

  /**
   * Array-backed properties and their defaults. The attribute holds the items
   * comma-separated (`items="a, b"`); the property is a `string[]`.
   */
  static arrayDefaults: ArrayDefaults = {};

  /** Attributes the browser reports to `attributeChangedCallback`. */
  static get observedAttributes(): string[] {
    return [
      ...Object.keys(this.defaults).map(toKebabCase),
      ...Object.keys(this.arrayDefaults).map(toKebabCase),
    ];
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
  #arrayDefaults: ArrayDefaults = {};
  #arrays: Record<string, string[]> = {};
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
    this.#arrayDefaults = ctor.arrayDefaults;
    this.#arrays = {};
    for (const key of Object.keys(ctor.arrayDefaults)) {
      this.#arrays[key] = [...ctor.arrayDefaults[key]];
    }
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

    for (const key of Object.keys(ctor.arrayDefaults)) {
      Object.defineProperty(this, key, {
        configurable: true,
        enumerable: true,
        get: () => [...(this.#arrays[key] ?? [])],
        set: (next: string[] | string) => this.#assignList(key, next),
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

  /**
   * Constraint validation in the owning form. Forwards to `ElementInternals`
   * when available; without internals there is nothing to validate, so it
   * reports `true`.
   */
  checkValidity(): boolean {
    const internals = this.internals;
    if (!internals || typeof internals.checkValidity !== 'function') return true;
    return internals.checkValidity();
  }

  /** Like `checkValidity()`, but asks the platform to report the problem. */
  reportValidity(): boolean {
    const internals = this.internals;
    if (!internals || typeof internals.reportValidity !== 'function') return true;
    return internals.reportValidity();
  }

  /**
   * Resets the control to the state it was mounted with and re-renders.
   * Delegates to `formResetCallback()` so a subclass only overrides
   * `onFormReset()`.
   */
  reset(): void {
    this.formResetCallback();
    this.requestUpdate();
  }

  /**
   * Serializes this element the way `new FormData(form)` would: one row per
   * `formEntries()` entry, or `null` when the element submits nothing.
   */
  getFormData(): FormData | null {
    const entries = this.formEntries();
    if (entries.length === 0) return null;
    const data = new FormData();
    for (const [name, value] of entries) data.append(name, value);
    return data;
  }

  /**
   * Rows this element contributes to `FormData`. Defaults to `name` + `value`
   * when both are usable; subclasses with a richer payload override it.
   */
  protected formEntries(): Array<[string, string | File]> {
    const { name, value } = this as unknown as { name?: unknown; value?: unknown };
    if (typeof name !== 'string' || name.length === 0) return [];
    if (typeof value !== 'string' && typeof value !== 'number') return [];
    return [[name, String(value)]];
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
    if (key in this.#arrayDefaults) {
      this.#arrays[key] = toList(value, this.#arrayDefaults[key]); // attribute -> list property
      if (this.#rendered && !this.#reflecting) this.requestUpdate();
      return;
    }
    if (!(key in this.#defaults)) return;
    this.#values[key] = this.#coerce(key, value); // attribute -> camelCase property
    if (this.#rendered && !this.#reflecting) this.requestUpdate();
  }

  #assignList(key: string, next: string[] | string): void {
    const value = Array.isArray(next)
      ? next.map((part) => String(part).trim()).filter((part) => part.length > 0)
      : toList(next, []);
    if (sameList(this.#arrays[key] ?? [], value)) return;
    this.#arrays[key] = value;
    this.#reflectList(key, value);
  }

  #reflectList(key: string, value: string[]): void {
    const attribute = toKebabCase(key);
    const fallback = this.#arrayDefaults[key] ?? [];
    this.#reflecting = true;
    try {
      if (value.length === 0 || sameList(value, fallback)) this.removeAttribute(attribute);
      else this.setAttribute(attribute, value.join(','));
    } finally {
      this.#reflecting = false;
    }
    if (this.#rendered) this.requestUpdate();
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
