/** One invalid control, as reported by `an-form-invalid` and `validate()`. */
export interface AnFormFieldError {
  /** The control's `name` attribute; empty when the control has none. */
  name: string;
  /** The platform message, or a generic one when the control carries none. */
  message: string;
  /** The control itself, so the consumer can focus or decorate it. */
  element: Element;
}

/** Payload of `an-form-submit`. */
export interface AnFormSubmitDetail {
  /** One entry per submitted value, in control order. */
  formData: FormData;
  /** JSON-safe snapshot of `formData`; repeated names become arrays. */
  values: Record<string, string | string[]>;
}

/** Payload of `an-form-invalid`. */
export interface AnFormInvalidDetail {
  /** Every control that failed its constraint validation, in control order. */
  fields: AnFormFieldError[];
}

/** Lower bound of the controls `<an-form>` understands. */
type FormControl = Element & {
  checkValidity(): boolean;
  reportValidity?(): boolean;
  reset?(): void;
  getFormData?(): FormData | null;
  validationMessage?: string;
};

/** Used when a control is invalid but exposes no platform message. */
const FALLBACK_ERROR = '请输入有效值';

/** Single document-level stylesheet: a form host is a transparent container. */
const STYLE_ID = 'an-form-styles';

function ensureFormStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const target = document.head ?? document.documentElement;
  if (!target) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = 'an-form { display: contents; }';
  target.append(style);
}

/** Whether the user asked the platform to tone motion down. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Flattens `FormData` into a JSON-safe object; repeated names become arrays. */
function toValues(data: FormData): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const [name, entry] of data.entries()) {
    const value = typeof entry === 'string' ? entry : entry.name;
    const current = values[name];
    if (current === undefined) values[name] = value;
    else if (Array.isArray(current)) current.push(value);
    else values[name] = [current, value];
  }
  return values;
}

/**
 * `<an-form>` — the container that gives custom controls form semantics without
 * requiring a native `<form>`.
 *
 * It deliberately has **no shadow root**: the host is the container (styled
 * `display: contents`), so slotted/native markup keeps its place in the light
 * DOM and the platform's focus and label associations still work. Every custom
 * element inside that exposes `checkValidity()` is treated as a control;
 * controls nested inside another control (for example the `<an-checkbox>`
 * options of an `<an-checkbox-group>`) belong to their owner and are skipped.
 *
 * There is no disabled cascade: wrap the form in `<fieldset disabled>` to
 * disable everything at once.
 *
 * @attr {boolean} novalidate - Skip constraint validation on `submit()`, like the native attribute.
 * @attr {boolean} loading - Marks a submission in flight; the form itself changes no behaviour and leaves the buttons untouched.
 * @fires an-form-submit - Fired after a successful `submit()`; `detail = { formData, values }`.
 * @fires an-form-invalid - Fired when `submit()` finds invalid controls; `detail = { fields }`.
 * @fires an-form-reset - Fired after `reset()`; the detail is empty.
 */
export class AnForm extends HTMLElement {
  constructor() {
    super();
    ensureFormStyles();
    // Capture, so a submit button inside another shadow root (e.g. `<an-button>`)
    // is routed here before the button's own handler can do anything.
    this.addEventListener('click', this.#onClick, true);
  }

  /** Mirrors the `novalidate` attribute. */
  get novalidate(): boolean {
    return this.hasAttribute('novalidate');
  }

  set novalidate(value: boolean) {
    this.toggleAttribute('novalidate', Boolean(value));
  }

  /** Mirrors the `loading` attribute; purely a state hook for consumers. */
  get loading(): boolean {
    return this.hasAttribute('loading');
  }

  set loading(value: boolean) {
    this.toggleAttribute('loading', Boolean(value));
  }

  /** Validates every control without reporting anything. */
  validate(): { valid: boolean; fields: AnFormFieldError[] } {
    const fields = this.#invalidFields();
    return { valid: fields.length === 0, fields };
  }

  /**
   * Validates and, when everything is valid, announces the payload. Returns
   * `false` after reporting the first problem, so a click handler can cancel
   * whatever it was about to do.
   */
  submit(): boolean {
    const fields = this.novalidate ? [] : this.#invalidFields();
    if (fields.length > 0) {
      for (const field of fields) {
        const control = field.element as FormControl;
        control.reportValidity?.();
      }
      this.dispatchEvent(
        new CustomEvent<AnFormInvalidDetail>('an-form-invalid', {
          bubbles: true,
          composed: true,
          detail: { fields },
        }),
      );
      const first = fields[0];
      if (first) this.#focusFirst(first);
      return false;
    }
    const formData = this.getFormData();
    this.dispatchEvent(
      new CustomEvent<AnFormSubmitDetail>('an-form-submit', {
        bubbles: true,
        composed: true,
        detail: { formData, values: toValues(formData) },
      }),
    );
    return true;
  }

  /** Resets every control and announces it. */
  reset(): void {
    for (const control of this.#controls()) control.reset?.();
    this.dispatchEvent(
      new CustomEvent('an-form-reset', { bubbles: true, composed: true }),
    );
  }

  /** Serializes every control, in DOM order, the way a native form would. */
  getFormData(): FormData {
    const data = new FormData();
    for (const control of this.#controls()) {
      const own = control.getFormData?.();
      if (!own) continue;
      for (const [name, value] of own.entries()) data.append(name, value);
    }
    return data;
  }

  /**
   * Every control owned by this form, in document order.
   *
   * A descendant counts when it exposes `checkValidity()` and is either named
   * (`[name]`) or a form-associated custom element. Descendants of a control
   * are skipped: they belong to that control (radio / checkbox options), not to
   * the form.
   */
  #controls(): FormControl[] {
    const controls: FormControl[] = [];
    const owned = new Set<Element>();
    for (const element of Array.from(this.querySelectorAll('*'))) {
      if (owned.has(element)) continue;
      if (element.closest('an-form') !== this) continue;
      const candidate = element as Partial<FormControl>;
      if (typeof candidate.checkValidity !== 'function') continue;
      const formAssociated =
        (element.constructor as unknown as { formAssociated?: boolean }).formAssociated === true;
      if (!element.hasAttribute('name') && !formAssociated) continue;
      controls.push(element as FormControl);
      for (const child of Array.from(element.querySelectorAll('*'))) owned.add(child);
    }
    return controls;
  }

  /** Controls that fail their own validation, with their platform message. */
  #invalidFields(): AnFormFieldError[] {
    const fields: AnFormFieldError[] = [];
    for (const control of this.#controls()) {
      if (control.checkValidity()) continue;
      const message = control.validationMessage;
      fields.push({
        name: control.getAttribute('name') ?? '',
        message: typeof message === 'string' && message.length > 0 ? message : FALLBACK_ERROR,
        element: control,
      });
    }
    return fields;
  }

  /** Scrolls the first problem into view and focuses it. */
  #focusFirst(field: AnFormFieldError): void {
    const element = field.element as HTMLElement;
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({
        block: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }
    if (typeof element.focus === 'function') element.focus();
    // Most controls keep their real focusable node behind a shadow boundary and
    // do not forward `focus()` from the host, so focus the inner node as well.
    const root = element.shadowRoot;
    if (!root || root.activeElement) return;
    const inner = root.querySelector<HTMLElement>(
      'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
    );
    inner?.focus();
  }

  /** The `<an-button>` in the event path, regardless of which shadow emitted it. */
  #buttonFrom(event: Event): HTMLElement | null {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      if (node instanceof HTMLElement && node.localName === 'an-button') return node;
    }
    return null;
  }

  /**
   * A button that already has a real form owner must keep the platform
   * behaviour; only "orphan" buttons are routed through this element.
   */
  #hasRealFormOwner(button: HTMLElement): boolean {
    if (button.closest('form')) return true;
    const internals = (button as unknown as { internals?: { form?: unknown } | null }).internals;
    if (internals?.form) return true;
    const formId = button.getAttribute('form');
    if (!formId) return false;
    return button.ownerDocument.getElementById(formId) instanceof HTMLFormElement;
  }

  #onClick = (event: MouseEvent): void => {
    const button = this.#buttonFrom(event);
    if (!button || button.closest('an-form') !== this) return;
    const type = button.getAttribute('type');
    if (type !== 'submit' && type !== 'reset') return;
    const state = button as unknown as { disabled?: boolean; loading?: boolean };
    if (state.disabled || state.loading) return;
    if (this.#hasRealFormOwner(button)) return;
    event.preventDefault();
    if (type === 'submit') this.submit();
    else this.reset();
  };
}
