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

/**
 * One declarative rule checked for a named field.
 *
 * The six platform-shaped properties (`required`, `pattern`, `min`, `max`,
 * `minLength`, `maxLength`) also run from the synchronous `validate()` /
 * `submit()` path. `validator` is only executed by the asynchronous API, since
 * a caller that cannot await has no way to use its result.
 */
export type AnFormRule = {
  /** The field must hold a non-blank value. */
  required?: boolean;
  /** Value must match this pattern; a string is compiled with `new RegExp()`. */
  pattern?: RegExp | string;
  /** Numeric lower bound; skipped for blank and non-numeric values. */
  min?: number;
  /** Numeric upper bound; skipped for blank and non-numeric values. */
  max?: number;
  /** Shortest accepted string length; skipped for a blank value. */
  minLength?: number;
  /** Longest accepted string length; skipped for a blank value. */
  maxLength?: number;
  /**
   * Custom check. Return `null` when the value is acceptable, or the message to
   * show. May return a promise; only `validateAsync()`, `submitAsync()` and
   * `validateField()` await it.
   */
  validator?: (value: string, form: AnForm) => string | null | Promise<string | null>;
  /** Message for every rule in this object; a Chinese default is used otherwise. */
  message?: string;
};

/** Rules keyed by control `name`; an array runs in declaration order. */
export type AnFormRules = Record<string, AnFormRule | AnFormRule[]>;

/** Lower bound of the controls `<an-form>` understands. */
type FormControl = Element & {
  checkValidity(): boolean;
  reportValidity?(): boolean;
  reset?(): void;
  getFormData?(): FormData | null;
  validationMessage?: string;
  value?: unknown;
  checked?: unknown;
};

type ControlValidity = { valid: boolean; message: string; disabled: boolean };

type SubmissionSnapshot = {
  controls: FormControl[];
  values: Map<FormControl, string>;
  signatures: Map<FormControl, string>;
  validity: Map<FormControl, ControlValidity>;
  formData: FormData;
  rules: AnFormRules;
  rulesRevision: number;
  stateRevision: number;
  runRevision: number;
};

/** Used when a control is invalid but exposes no platform message. */
const FALLBACK_ERROR = '请输入有效值';

/** Events a control emits after its value changed. */
const VALUE_EVENTS = [
  'input',
  'change',
  'an-input',
  'an-change',
  'an-checkbox-change',
  'an-switch-change',
  'an-radio-change',
  'an-select-change',
  'an-textarea-change',
  'an-checkbox-group-change',
  'an-number-change',
  'an-date-change',
  'an-date-range-change',
  'an-upload-change',
] as const;

/** Marks the light-DOM node this element owns; `#controls()` skips it. */
const OWN_ATTR = 'data-an-form-own';

/** Instance key carrying the rule message reported through `invalid`. */
const RULE_MESSAGE = Symbol('an-form-rule-message');

/** Single document-level stylesheet: a form host is a transparent container. */
const STYLE_ID = 'an-form-styles';

/** Escapes text inserted into the error summary markup. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

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
  const values = new Map<string, string | string[]>();
  for (const [name, entry] of data.entries()) {
    const value = typeof entry === 'string' ? entry : entry.name;
    const current = values.get(name);
    if (current === undefined) values.set(name, value);
    else if (Array.isArray(current)) current.push(value);
    else values.set(name, [current, value]);
  }
  return Object.fromEntries(values) as Record<string, string | string[]>;
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
 * The `data-an-form-own` marker used by the built-in error summary is skipped
 * as well.
 *
 * Declarative rules are supplied through the `rules` property and run on top of
 * each control's own platform validation. The synchronous API (`validate()`,
 * `submit()`) runs only the platform-shaped rules; rules with a `validator` need
 * `validateAsync()`, `submitAsync()` or `validateField()`, because a promise
 * cannot be resolved by a caller that expects a boolean. A failing rule decorates
 * the control with `aria-invalid="true"`, publishes its message through the
 * control's `validationMessage` and dispatches a non-bubbling `invalid` event, so
 * an enclosing `<an-field>` renders it exactly like a platform error.
 *
 * Dirty tracking snapshots every control on connection (and whenever a control
 * is added later); `reset()` restores the baseline so the form is clean again.
 *
 * There is no disabled cascade: wrap the form in `<fieldset disabled>` to
 * disable everything at once.
 *
 * @attr {boolean} novalidate - Skip constraint validation on `submit()` / `submitAsync()`, like the native attribute.
 * @attr {boolean} loading - Marks a submission in flight; the form itself changes no behaviour and leaves the buttons untouched.
 * @attr {boolean} show-error-summary - Render a clickable list of the current problems as the first child of the host.
 * @fires an-form-submit - Fired after a successful `submit()` / `submitAsync()`; `detail = { formData, values }`.
 * @fires an-form-invalid - Fired when a submit finds invalid controls; `detail = { fields }`.
 * @fires an-form-reset - Fired after `reset()`; the detail is empty.
 * @csspart error-summary - The `<div role="alert">` list rendered when `show-error-summary` is on.
 * @csspart error-summary-item - The `<button>` of one summary entry.
 */
export class AnForm extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['show-error-summary'];
  }

  #rules: AnFormRules = {};
  #rulesRevision = 0;
  #stateRevision = 0;
  #runRevision = 0;
  #baseline = new Map<Element, string>();
  #observer: MutationObserver | null = null;

  /** Controls whose failure came from a declarative rule, with its message. */
  #presented = new Map<FormControl, string>();

  /** Values `aria-invalid` carried before this element decorated the control. */
  #ariaInvalid = new WeakMap<Element, string | null>();

  /** Controls where `validationMessage` was shadowed with a rule message. */
  #customMessage = new WeakSet<Element>();

  #summary: HTMLElement | null = null;
  #summaryFields: AnFormFieldError[] = [];

  constructor() {
    super();
    ensureFormStyles();
    // Capture, so a submit button inside another shadow root (e.g. `<an-button>`)
    // is routed here before the button's own handler can do anything.
    this.addEventListener('click', this.#onClick, true);
    for (const type of VALUE_EVENTS) this.addEventListener(type, this.#onValueChange);
  }

  connectedCallback(): void {
    this.#observe();
    this.#captureBaseline();
    // Children upgrade/attach after the host does, so capture once more after
    // the current task settles.
    queueMicrotask(() => {
      if (this.isConnected) this.#captureBaseline();
    });
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    if (this.#summaryFields.length > 0) this.#renderSummary(this.#summaryFields);
    else this.#removeSummary();
  }

  /** Mirrors the `novalidate` attribute; a submit skips every rule when set. */
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

  /** Mirrors the `show-error-summary` attribute. */
  get showErrorSummary(): boolean {
    return this.hasAttribute('show-error-summary');
  }

  set showErrorSummary(value: boolean) {
    this.toggleAttribute('show-error-summary', Boolean(value));
  }

  /**
   * Declarative rules keyed by field name. Replacing the object drops stale rule
   * errors from the UI; the rules themselves run on the next validation.
   */
  get rules(): AnFormRules {
    return this.#rules;
  }

  set rules(value: AnFormRules) {
    this.#rules = value && typeof value === 'object' ? value : {};
    this.#rulesRevision += 1;
    this.#runRevision += 1;
    this.#clearPresented();
    this.#removeSummary();
  }

  /** `true` while at least one named field differs from the connection snapshot. */
  get isDirty(): boolean {
    return this.#dirtyFields().length > 0;
  }

  /** Names of the fields whose value differs from the connection snapshot. */
  get dirtyFields(): string[] {
    return this.#dirtyFields();
  }

  /** Validates every control and declarative rule without reporting anything. */
  validate(): { valid: boolean; fields: AnFormFieldError[] } {
    const { fields } = this.#collectSync();
    return { valid: fields.length === 0, fields };
  }

  /**
   * Synchronous validation never awaits a `validator`: rules that carry one are
   * skipped here and left to `validateAsync()`. Platform constraints and the
   * other five rule kinds still run.
   */
  async validateAsync(): Promise<{ valid: boolean; fields: AnFormFieldError[] }> {
    const snapshot = this.#captureSubmissionSnapshot();
    const { fields } = await this.#collectAsyncSnapshot(snapshot);
    return { valid: fields.length === 0, fields };
  }

  /**
   * Validates and, when everything is valid, announces the payload. Returns
   * `false` after reporting the first problem, so a click handler can cancel
   * whatever it was about to do. With `novalidate` set, every rule is skipped.
   */
  submit(): boolean {
    this.#runRevision += 1;
    if (this.novalidate) return this.#announceSubmit();
    const { fields, ruleMessages } = this.#collectSync();
    if (fields.length > 0) {
      this.#reportInvalid(fields, ruleMessages);
      return false;
    }
    return this.#announceSubmit();
  }

  /**
   * Asynchronous twin of `submit()`: awaits every `validator`, then behaves like
   * `submit()` — submit on success, `an-form-invalid` plus reporting otherwise.
   * With `novalidate` set, even the validators are skipped.
   */
  async submitAsync(): Promise<boolean> {
    this.#runRevision += 1;
    this.#clearPresented();
    this.#removeSummary();
    const snapshot = this.#captureSubmissionSnapshot(this.#runRevision);
    if (this.novalidate) return this.#announceSnapshotSubmit(snapshot);
    return this.#submitAsyncAttempt(snapshot, 0);
  }

  async #submitAsyncAttempt(snapshot: SubmissionSnapshot, retries: number): Promise<boolean> {
    const { fields, ruleMessages } = await this.#collectAsyncSnapshot(snapshot);
    if (!this.#isSnapshotCurrent(snapshot)) {
      if (retries < 1 && snapshot.runRevision === this.#runRevision) {
        return this.#submitAsyncAttempt(
          this.#captureSubmissionSnapshot(snapshot.runRevision),
          retries + 1,
        );
      }
      // Do not report or submit a result for a form that is still changing.
      return false;
    }
    if (fields.length > 0) {
      this.#reportInvalid(fields, ruleMessages);
      return false;
    }
    return this.#announceSnapshotSubmit(snapshot);
  }

  /**
   * Validates one named field, awaiting its `validator`. `true` when the field is
   * absent or valid. Does not decorate the control or touch the error summary.
   */
  async validateField(name: string): Promise<boolean> {
    const { fields } = await this.#collectAsync(name);
    return fields.length === 0;
  }

  /** Values a named field submitted, or `null` when no such control exists. */
  getFieldValue(name: string): string | null {
    for (const control of this.#controls()) {
      if ((control.getAttribute('name') ?? '') !== name) continue;
      return this.#readValue(control, name);
    }
    return null;
  }

  /** Resets one named field and clears its rule error. */
  resetField(name: string): void {
    this.#stateRevision += 1;
    this.#runRevision += 1;
    const controls = this.#controls().filter(
      (control) => (control.getAttribute('name') ?? '') === name,
    );
    if (controls.length === 0) return;
    for (const control of controls) {
      control.reset?.();
      this.#clearInvalid(control);
      this.#presented.delete(control);
      this.#baseline.set(control, this.#signature(control));
    }
    if (this.#summaryFields.length > 0) {
      this.#renderSummary(
        this.#summaryFields.filter((field) => !controls.includes(field.element as FormControl)),
      );
    }
  }

  /** Resets every control and announces it. */
  reset(): void {
    this.#stateRevision += 1;
    this.#runRevision += 1;
    const controls = this.#controls();
    for (const control of controls) control.reset?.();
    this.#clearPresented();
    this.#removeSummary();
    // The snapshot survives, but the form must be clean right after a reset; a
    // well-behaved control restores its mount value, which is the same baseline.
    for (const control of controls) this.#baseline.set(control, this.#signature(control));
    this.dispatchEvent(
      new CustomEvent('an-form-reset', { bubbles: true, composed: true }),
    );
  }

  /** Serializes every control, in DOM order, the way a native form would. */
  getFormData(): FormData {
    return this.#formDataForControls(this.#controls());
  }

  #formDataForControls(controls: FormControl[]): FormData {
    const data = new FormData();
    for (const control of controls) {
      if (this.#isDisabled(control)) continue;
      if (this.#checkableType(control) && !control.checked) continue;
      const own = control.getFormData?.();
      if (own) {
        for (const [name, value] of own.entries()) data.append(name, value);
        continue;
      }
      const name = control.getAttribute('name');
      if (!name) continue;
      data.append(name, this.#fallbackValue(control));
    }
    return data;
  }

  /** Dispatches `an-form-submit`; shared by the sync and async paths. */
  #announceSubmit(): boolean {
    this.#clearPresented();
    this.#removeSummary();
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

  /** Reports invalid fields the way `submit()` always has, plus rule errors. */
  #reportInvalid(fields: AnFormFieldError[], ruleMessages: Map<FormControl, string>): void {
    this.#present(ruleMessages);
    this.#renderSummary(fields);
    for (const field of fields) {
      const control = field.element as FormControl;
      // Rule failures already dispatched `invalid` while being presented.
      if (ruleMessages.has(control)) continue;
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
  }

  /**
   * Every control owned by this form, in document order.
   *
   * A descendant counts when it exposes `checkValidity()` and is either named
   * (`[name]`) or a form-associated custom element. Descendants of a control
   * are skipped: they belong to that control (radio / checkbox options), not to
   * the form. Nodes carrying `data-an-form-own` (the error summary) are skipped
   * as well.
   */
  #controls(): FormControl[] {
    const controls: FormControl[] = [];
    const owned = new Set<Element>();
    for (const element of Array.from(this.querySelectorAll('*'))) {
      if (owned.has(element)) continue;
      if (element.closest(`[${OWN_ATTR}]`)) continue;
      if (element.closest('an-form') !== this) continue;
      if (typeof (element as Partial<FormControl>).checkValidity !== 'function') continue;
      const formAssociated =
        (element.constructor as unknown as { formAssociated?: boolean }).formAssociated === true;
      if (!element.hasAttribute('name') && !formAssociated) continue;
      controls.push(element as FormControl);
      for (const child of Array.from(element.querySelectorAll('*'))) owned.add(child);
    }
    return controls;
  }

  /** Controls filtered down to one field name when given. */
  #scoped(onlyName?: string): FormControl[] {
    if (onlyName === undefined) return this.#controls();
    return this.#controls().filter((control) => (control.getAttribute('name') ?? '') === onlyName);
  }

  #isDisabled(control: FormControl): boolean {
    const candidate = control as FormControl & { disabled?: unknown };
    if (
      candidate.disabled === true ||
      control.hasAttribute('disabled') ||
      control.hasAttribute('data-form-disabled')
    ) return true;
    for (let ancestor = control.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.localName !== 'fieldset' || !ancestor.hasAttribute('disabled')) continue;
      const legend = Array.from(ancestor.children).find((child) => child.localName === 'legend');
      if (!legend?.contains(control)) return true;
    }
    return false;
  }

  /** Native input types and explicit custom-control roles that use checked state. */
  #checkableType(control: FormControl): 'checkbox' | 'radio' | null {
    if (control.localName === 'input') {
      const type = (control as HTMLInputElement).type;
      return type === 'checkbox' || type === 'radio' ? type : null;
    }
    const role = control.getAttribute('role');
    if (role === 'radio' || control.localName === 'an-radio') return 'radio';
    if (
      role === 'checkbox' || role === 'switch' ||
      control.localName === 'an-checkbox' || control.localName === 'an-switch'
    ) return 'checkbox';
    return null;
  }

  /** Named radio groups share one rule check; platform checks stay per control. */
  #ruleControls(controls: FormControl[]): Set<FormControl> {
    const targets = new Set<FormControl>();
    const radios = new Set<string>();
    for (const control of controls) {
      if (this.#isDisabled(control)) continue;
      const name = control.getAttribute('name') ?? '';
      if (name && this.#checkableType(control) === 'radio') {
        if (radios.has(name)) continue;
        radios.add(name);
      }
      targets.add(control);
    }
    return targets;
  }

  #readRuleValue(control: FormControl, name: string, controls?: FormControl[]): string {
    if (this.#checkableType(control) !== 'radio') return this.#readValue(control, name);
    const selected = (controls ?? this.#controls()).find((candidate) =>
      candidate.getAttribute('name') === name &&
      this.#checkableType(candidate) === 'radio' &&
      !this.#isDisabled(candidate) && candidate.checked === true,
    );
    return selected ? this.#readValue(selected, name) : '';
  }

  /** Platform constraints plus the synchronous rules. */
  #collectSync(onlyName?: string): {
    fields: AnFormFieldError[];
    ruleMessages: Map<FormControl, string>;
  } {
    const fields: AnFormFieldError[] = [];
    const ruleMessages = new Map<FormControl, string>();
    const controls = this.#scoped(onlyName);
    const ruleControls = this.#ruleControls(controls);
    for (const control of controls) {
      const name = control.getAttribute('name') ?? '';
      const ruleMessage = name && ruleControls.has(control) ? this.#syncRuleMessage(control, name) : null;
      this.#pushField(fields, ruleMessages, control, name, ruleMessage);
    }
    return { fields, ruleMessages };
  }

  async #collectAsyncSnapshot(snapshot: SubmissionSnapshot): Promise<{
    fields: AnFormFieldError[];
    ruleMessages: Map<FormControl, string>;
  }> {
    const fields: AnFormFieldError[] = [];
    const ruleMessages = new Map<FormControl, string>();
    const ruleControls = this.#ruleControls(snapshot.controls);
    for (const control of snapshot.controls) {
      const name = control.getAttribute('name') ?? '';
      const value = snapshot.values.get(control) ?? '';
      const ruleMessage = name && ruleControls.has(control)
        ? await this.#asyncRuleMessage(control, name, value, snapshot.rules)
        : null;
      const validity = snapshot.validity.get(control)!;
      if (validity.disabled) continue;
      if (!validity.valid) {
        fields.push({
          name,
          message: validity.message || FALLBACK_ERROR,
          element: control,
        });
      } else if (ruleMessage !== null) {
        ruleMessages.set(control, ruleMessage);
        fields.push({ name, message: ruleMessage, element: control });
      }
    }
    return { fields, ruleMessages };
  }

  #captureSubmissionSnapshot(runRevision = this.#runRevision): SubmissionSnapshot {
    const controls = this.#controls();
    const values = new Map<FormControl, string>();
    const signatures = new Map<FormControl, string>();
    const validity = new Map<FormControl, ControlValidity>();
    for (const control of controls) {
      const name = control.getAttribute('name') ?? '';
      values.set(control, this.#readRuleValue(control, name, controls));
      const state = this.#controlValidity(control);
      validity.set(control, state);
      signatures.set(control, this.#submissionSignature(control, state));
    }
    return {
      controls,
      values,
      signatures,
      validity,
      formData: this.#formDataForControls(controls),
      rules: this.#rules,
      rulesRevision: this.#rulesRevision,
      stateRevision: this.#stateRevision,
      runRevision,
    };
  }

  #isSnapshotCurrent(snapshot: SubmissionSnapshot): boolean {
    if (
      snapshot.rules !== this.#rules ||
      snapshot.rulesRevision !== this.#rulesRevision ||
      snapshot.stateRevision !== this.#stateRevision ||
      snapshot.runRevision !== this.#runRevision
    ) return false;
    const controls = this.#controls();
    if (controls.length !== snapshot.controls.length) return false;
    return snapshot.controls.every(
      (control, index) => controls[index] === control &&
        this.#submissionSignature(control, this.#controlValidity(control)) === snapshot.signatures.get(control),
    );
  }

  #controlValidity(control: FormControl): ControlValidity {
    const disabled = this.#isDisabled(control);
    const valid = disabled || control.checkValidity();
    const message = typeof control.validationMessage === 'string' ? control.validationMessage : '';
    return { valid, message, disabled };
  }

  /** Submission state includes constraints even when they still accept the value. */
  #submissionSignature(control: FormControl, validity: ControlValidity): string {
    const constraints = [
      'required', 'pattern', 'min', 'max', 'minlength', 'maxlength',
      'step', 'multiple', 'readonly', 'type',
    ].map((name) => [name, control.getAttribute(name)]);
    return JSON.stringify([
      this.#signature(control), control.getAttribute('name'), this.#checkableType(control),
      control.checked, constraints, validity,
    ]);
  }

  /** Emits the exact FormData captured before async validation began. */
  #announceSnapshotSubmit(snapshot: SubmissionSnapshot): boolean {
    this.#clearPresented();
    this.#removeSummary();
    this.dispatchEvent(
      new CustomEvent<AnFormSubmitDetail>('an-form-submit', {
        bubbles: true,
        composed: true,
        detail: { formData: snapshot.formData, values: toValues(snapshot.formData) },
      }),
    );
    return true;
  }

  #hasAsyncValidator(): boolean {
    return this.#controls().some((control) => {
      if (this.#isDisabled(control)) return false;
      const name = control.getAttribute('name') ?? '';
      return this.#rulesFor(name).some((rule) => typeof rule.validator === 'function');
    });
  }

  /** Platform constraints, synchronous rules and awaited validators. */
  async #collectAsync(onlyName?: string): Promise<{
    fields: AnFormFieldError[];
    ruleMessages: Map<FormControl, string>;
  }> {
    const fields: AnFormFieldError[] = [];
    const ruleMessages = new Map<FormControl, string>();
    const controls = this.#scoped(onlyName);
    const ruleControls = this.#ruleControls(controls);
    for (const control of controls) {
      const name = control.getAttribute('name') ?? '';
      const ruleMessage = name && ruleControls.has(control) ? await this.#asyncRuleMessage(control, name) : null;
      this.#pushField(fields, ruleMessages, control, name, ruleMessage);
    }
    return { fields, ruleMessages };
  }

  /**
   * Appends one control's failure, preferring the platform message when the
   * control is invalid on its own and the first rule message otherwise.
   */
  #pushField(
    fields: AnFormFieldError[],
    ruleMessages: Map<FormControl, string>,
    control: FormControl,
    name: string,
    ruleMessage: string | null,
  ): void {
    if (this.#isDisabled(control)) return;
    if (control.checkValidity()) {
      if (ruleMessage === null) return;
      ruleMessages.set(control, ruleMessage);
      fields.push({ name, message: ruleMessage, element: control });
      return;
    }
    const platformMessage = control.validationMessage;
    fields.push({
      name,
      message:
        typeof platformMessage === 'string' && platformMessage.length > 0
          ? platformMessage
          : FALLBACK_ERROR,
      element: control,
    });
  }

  /** Rules registered for a field name, normalised to an array. */
  #rulesFor(name: string, source: AnFormRules = this.#rules): AnFormRule[] {
    const entry = source[name];
    if (!entry) return [];
    return Array.isArray(entry) ? entry : [entry];
  }

  /** First failing synchronous rule message for a control, if any. */
  #syncRuleMessage(control: FormControl, name: string): string | null {
    const value = this.#readRuleValue(control, name);
    let message: string | null = null;
    for (const rule of this.#rulesFor(name)) {
      const failed = this.#checkDeclarative(rule, value);
      if (failed !== null && message === null) message = failed;
    }
    return message;
  }

  /** First failing message for a control, including awaited validators. */
  async #asyncRuleMessage(
    control: FormControl,
    name: string,
    capturedValue = this.#readRuleValue(control, name),
    source: AnFormRules = this.#rules,
  ): Promise<string | null> {
    if (this.#isDisabled(control)) return null;
    const value = capturedValue;
    let message: string | null = null;
    for (const rule of this.#rulesFor(name, source)) {
      const failed = this.#checkDeclarative(rule, value);
      if (failed !== null && message === null) message = failed;
      if (!rule.validator) continue;
      let result: string | null;
      try {
        result = await rule.validator(value, this);
      } catch (error) {
        result = error instanceof Error && error.message.length > 0 ? error.message : '校验失败';
      }
      if (typeof result === 'string' && result.length > 0 && message === null) message = result;
    }
    return message;
  }

  /**
   * Runs the platform-shaped rules. `validator` is deliberately absent: it only
   * runs from the asynchronous path.
   */
  #checkDeclarative(rule: AnFormRule, value: string): string | null {
    if (rule.required && value.trim().length === 0) {
      return rule.message ?? '此项为必填项';
    }
    if (value.length === 0) return null;
    if (rule.pattern !== undefined) {
      let pattern: RegExp | null = null;
      try {
        pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern) : rule.pattern;
      } catch {
        pattern = null;
      }
      if (pattern) {
        pattern.lastIndex = 0;
        if (!pattern.test(value)) return rule.message ?? '格式不正确';
      }
    }
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return rule.message ?? `长度不能少于 ${rule.minLength} 个字符`;
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return rule.message ?? `长度不能超过 ${rule.maxLength} 个字符`;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      if (rule.min !== undefined && numeric < rule.min) {
        return rule.message ?? `不能小于 ${rule.min}`;
      }
      if (rule.max !== undefined && numeric > rule.max) {
        return rule.message ?? `不能大于 ${rule.max}`;
      }
    }
    return null;
  }

  /** First value a control submits under its name, or its plain value fallback. */
  #readValue(control: FormControl, name: string): string {
    if (this.#checkableType(control) && !control.checked) return '';
    if (this.#isDisabled(control)) return '';
    const data = control.getFormData?.();
    const raw = data?.get(name);
    if (raw !== null && raw !== undefined) return typeof raw === 'string' ? raw : raw.name;
    return this.#fallbackValue(control);
  }

  /** Value used when a control exposes no `FormData` for the field. */
  #fallbackValue(control: FormControl): string {
    if (this.#checkableType(control)) {
      if (!control.checked) return '';
      if (typeof control.value === 'string') return control.value;
      return control.getAttribute('value') ?? 'true';
    }
    if (typeof control.value === 'string') return control.value;
    if (typeof control.value === 'number') return String(control.value);
    return '';
  }

  /** Stable serialization of one control, used by dirty tracking. */
  #signature(control: FormControl): string {
    const data = control.getFormData?.();
    if (data) {
      const entries = Array.from(data.entries());
      if (entries.length > 0) {
        return JSON.stringify(
          entries.map(([name, value]) => [
            name,
            typeof value === 'string' ? value : `file:${value.name}:${value.size}`,
          ]),
        );
      }
    }
    return JSON.stringify(['', this.#fallbackValue(control)]);
  }

  /** Names of the named fields whose value differs from the snapshot. */
  #dirtyFields(): string[] {
    const dirty: string[] = [];
    const seen = new Set<string>();
    for (const control of this.#controls()) {
      const name = control.getAttribute('name') ?? '';
      if (name.length === 0 || seen.has(name)) continue;
      const signature = this.#signature(control);
      const baseline = this.#baseline.get(control);
      if (baseline === undefined) {
        // A control added after connection has its first observed value as its
        // baseline, so a directly appended default is not reported as dirty.
        this.#baseline.set(control, signature);
        continue;
      }
      if (baseline !== signature) {
        dirty.push(name);
        seen.add(name);
      }
    }
    return dirty;
  }

  /** Records the current value of every control that has no snapshot yet. */
  #captureBaseline(): void {
    const next = new Map<Element, string>();
    for (const control of this.#controls()) {
      if (next.has(control)) continue;
      next.set(control, this.#baseline.get(control) ?? this.#signature(control));
    }
    this.#baseline = next;
  }

  #observe(): void {
    if (this.#observer || typeof MutationObserver === 'undefined') return;
    this.#observer = new MutationObserver(() => this.#captureBaseline());
    this.#observer.observe(this, { childList: true, subtree: true });
  }

  /** Clears every rule decoration currently on screen. */
  #clearPresented(): void {
    for (const control of this.#presented.keys()) this.#clearInvalid(control);
    this.#presented.clear();
  }

  /** Applies `aria-invalid`, the custom message and `invalid` for rule failures. */
  #present(ruleMessages: Map<FormControl, string>): void {
    for (const control of Array.from(this.#presented.keys())) {
      if (!ruleMessages.has(control)) this.#clearInvalid(control);
    }
    this.#presented.clear();
    for (const [control, message] of ruleMessages) {
      this.#markInvalid(control, message);
      this.#presented.set(control, message);
    }
  }

  /**
   * Decorates one control with a rule failure. The platform message is private
   * to each control (`ElementInternals` is protected), so the message is exposed
   * through a shadowing `validationMessage` getter and announced with a
   * non-bubbling `invalid` event — exactly the pair `<an-field>` listens for.
   */
  #markInvalid(control: FormControl, message: string): void {
    const element = control as unknown as HTMLElement;
    if (!this.#ariaInvalid.has(element)) {
      this.#ariaInvalid.set(element, element.getAttribute('aria-invalid'));
    }
    element.setAttribute('aria-invalid', 'true');
    if (!this.#customMessage.has(element)) {
      this.#customMessage.add(element);
      Object.defineProperty(element, 'validationMessage', {
        configurable: true,
        get: () => {
          const custom = (element as unknown as Record<symbol, unknown>)[RULE_MESSAGE];
          return typeof custom === 'string' ? custom : '';
        },
      });
    }
    (element as unknown as Record<symbol, unknown>)[RULE_MESSAGE] = message;
    element.dispatchEvent(new Event('invalid'));
  }

  /** Restores the control to the state it had before a rule decorated it. */
  #clearInvalid(control: FormControl): void {
    const element = control as unknown as HTMLElement;
    if (this.#customMessage.delete(element)) {
      Reflect.deleteProperty(element, 'validationMessage');
      Reflect.deleteProperty(element, RULE_MESSAGE);
    }
    if (!this.#ariaInvalid.has(element)) return;
    const previous = this.#ariaInvalid.get(element) ?? null;
    this.#ariaInvalid.delete(element);
    if (previous === null) element.removeAttribute('aria-invalid');
    else element.setAttribute('aria-invalid', previous);
  }

  /** Renders (or removes) the clickable error summary as the host's first child. */
  #renderSummary(fields: AnFormFieldError[]): void {
    this.#summaryFields = fields;
    if (!this.showErrorSummary || fields.length === 0) {
      this.#removeSummary();
      return;
    }
    if (!this.#summary) {
      const summary = document.createElement('div');
      summary.className = 'error-summary';
      summary.setAttribute('part', 'error-summary');
      summary.setAttribute('role', 'alert');
      summary.setAttribute(OWN_ATTR, '');
      summary.addEventListener('click', this.#onSummaryClick);
      this.prepend(summary);
      this.#summary = summary;
    }
    const items = fields
      .map((field, index) => {
        const label = field.name ? `${field.name}: ${field.message}` : field.message;
        return `<li><button type="button" part="error-summary-item" data-an-form-index="${index}">${escapeHtml(label)}</button></li>`;
      })
      .join('');
    this.#summary.innerHTML = `<ul part="error-summary-list">${items}</ul>`;
  }

  #removeSummary(): void {
    this.#summaryFields = [];
    if (!this.#summary) return;
    this.#summary.remove();
    this.#summary = null;
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
    if (type === 'submit') {
      if (this.#hasAsyncValidator()) void this.submitAsync();
      else this.submit();
    }
    else this.reset();
  };

  /** Clicking a summary entry scrolls to and focuses its control. */
  #onSummaryClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const item = target.closest('[data-an-form-index]');
    if (!item || !this.#summary?.contains(item)) return;
    event.preventDefault();
    const index = Number(item.getAttribute('data-an-form-index'));
    const field = this.#summaryFields[index];
    if (field) this.#focusFirst(field);
  };

  /** A value changed; drop stale rule decorations and the summary. */
  #onValueChange = (): void => {
    this.#stateRevision += 1;
    this.#clearPresented();
    this.#removeSummary();
  };
}
