/** @vitest-environment happy-dom */
/**
 * happy-dom 21 implements neither `HTMLElement.attachInternals()` nor
 * form-associated custom elements, so the platform slice `<an-input>` builds on
 * is shimmed here for the tests:
 *
 * - `attachInternals()` returns the subset of `ElementInternals` the component
 *   uses (`form`, `setFormValue`, `setValidity`, `aria*` reflection).
 * - `new FormData(form)` picks the registered value up, like the real entry list.
 * - `form.requestSubmit()` honours the registered validity: an invalid form
 *   fires `invalid` on the element and never submits.
 * - `form.reset()` calls `formResetCallback()` on associated elements.
 *
 * A `<fieldset disabled>` has no observable trigger under happy-dom, so tests
 * invoke `formDisabledCallback(true/false)` directly.
 */
export interface InternalsState {
  readonly element: HTMLElement;
  value: string | null;
  flags: Record<string, boolean>;
  message: string;
  anchor: Element | null;
  aria: Record<string, string | null>;
}

type FormAssociatedElement = HTMLElement & {
  name?: string;
  formResetCallback?: () => void;
};

const records: InternalsState[] = [];
const byElement = new WeakMap<HTMLElement, InternalsState>();

/** Attribute names the real `ElementInternals` ARIA reflection writes. */
const ARIA_ATTRIBUTES: Record<string, string> = {
  ariaDisabled: 'aria-disabled',
  ariaReadOnly: 'aria-readonly',
  ariaRequired: 'aria-required',
  ariaInvalid: 'aria-invalid',
};

const formOf = (element: HTMLElement): HTMLFormElement | null =>
  element.isConnected ? element.closest('form') : null;

/**
 * `form.contains()` instead of identity: happy-dom hands methods a different
 * wrapper object for the same form node than `querySelector()` returns.
 */
const belongsTo = (element: HTMLElement, form: HTMLFormElement): boolean =>
  element.isConnected && form.contains(element);

const isInvalid = (flags: Record<string, boolean>): boolean =>
  Object.keys(flags).some((key) => flags[key] === true);

const proto = HTMLElement.prototype as HTMLElement & {
  attachInternals?: () => unknown;
};

if (typeof proto.attachInternals !== 'function') {
  Object.defineProperty(proto, 'attachInternals', {
    configurable: true,
    writable: true,
    value(this: HTMLElement): unknown {
      const ctor = this.constructor as typeof HTMLElement & { formAssociated?: boolean };
      if (!ctor.formAssociated) {
        throw new DOMException('attachInternals() requires a form-associated element', 'NotSupportedError');
      }
      const record: InternalsState = {
        element: this,
        value: null,
        flags: {},
        message: '',
        anchor: null,
        aria: {},
      };
      records.push(record);
      byElement.set(this, record);

      const internals: Record<string, unknown> = {
        get form() {
          return formOf(record.element);
        },
        setFormValue(next: string | null) {
          record.value = next;
        },
        setValidity(
          flags: Record<string, boolean> = {},
          message = '',
          anchor: Element | null = null,
        ) {
          record.flags = flags;
          record.message = message;
          record.anchor = anchor;
        },
        get validity() {
          return { valid: !isInvalid(record.flags), ...record.flags };
        },
        get validationMessage() {
          return record.message;
        },
      };

      for (const [property, attribute] of Object.entries(ARIA_ATTRIBUTES)) {
        Object.defineProperty(internals, property, {
          get: () => record.aria[attribute] ?? null,
          set: (next: string | null) => {
            record.aria[attribute] = next;
            if (next === null || next === undefined) this.removeAttribute(attribute);
            else this.setAttribute(attribute, String(next));
          },
        });
      }
      return internals;
    },
  });
}

/** The shimmed internals behind an element, for assertions. */
export function internalsState(element: HTMLElement): InternalsState | null {
  return byElement.get(element) ?? null;
}

const NativeFormData = globalThis.FormData;

class ShimFormData extends NativeFormData {
  constructor(form?: HTMLFormElement, submitter?: HTMLElement | null) {
    super(form);
    if (!form) return;
    for (const record of records) {
      if (record.value === null || !belongsTo(record.element, form)) continue;
      const name = (record.element as FormAssociatedElement).name;
      if (name) this.append(name, record.value);
    }
    // The platform resolves the submitter's overrides here; the components under
    // test never pass one, so the parameter is only kept for signature parity.
    void submitter;
  }
}

Object.defineProperty(globalThis, 'FormData', {
  configurable: true,
  writable: true,
  value: ShimFormData,
});

const nativeRequestSubmit = HTMLFormElement.prototype.requestSubmit;

HTMLFormElement.prototype.requestSubmit = function requestSubmit(submitter?: HTMLElement): void {
  const invalid = records.filter(
    (record) => belongsTo(record.element, this) && isInvalid(record.flags),
  );
  if (invalid.length > 0) {
    // The platform runs interactive validation and fires `invalid` instead of
    // dispatching `submit` when the form is not valid.
    for (const record of invalid) {
      record.element.dispatchEvent(new Event('invalid', { cancelable: true }));
    }
    return;
  }
  nativeRequestSubmit?.call(this, submitter);
};

const nativeReset = HTMLFormElement.prototype.reset;

HTMLFormElement.prototype.reset = function reset(): void {
  nativeReset?.call(this);
  for (const record of records) {
    if (!belongsTo(record.element, this)) continue;
    (record.element as FormAssociatedElement).formResetCallback?.();
  }
};
