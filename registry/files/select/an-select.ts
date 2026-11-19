import selectStyles from './an-select.css?inline';
import { AnElement } from '../internal/base';
import { AnPopover } from '../internal/popover';
import type { AnOption } from '../option/an-option';

/** Control sizes of `<an-select>`. */
export type AnSelectSize = 'sm' | 'md' | 'lg';
/** Rendering strategies of the option list. */
export type AnSelectVirtual = 'auto' | 'on' | 'off';

/** A public snapshot of one option. */
export interface AnSelectOption {
  /** Value submitted when this option is selected. */
  value: string;
  /** Visible / accessible text of the option. */
  label: string;
  /** Whether the option can be picked. */
  disabled: boolean;
}

const SIZES: readonly AnSelectSize[] = ['sm', 'md', 'lg'];
const VIRTUAL_MODES: readonly AnSelectVirtual[] = ['auto', 'on', 'off'];

/** Shown to the owning form when `required` is set and nothing is selected. */
const REQUIRED_MESSAGE = '此字段为必填项。';

/** Fixed row height used by the virtual window, in pixels. */
const ITEM_HEIGHT = 40;
/** Extra rows rendered above and below the visible window when virtualizing. */
const VIRTUAL_BUFFER = 5;
/** Viewport height assumed when the listbox has not been laid out yet. */
const VIRTUAL_VIEWPORT = 320;
/** How long a search query must stay unchanged before `an-search` fires. */
const SEARCH_DEBOUNCE = 150;
/** How long single keystrokes accumulate into one typeahead query. */
const TYPEAHEAD_TIMEOUT = 500;

/** Internal, richer view of one light-DOM option. */
interface OptionRecord extends AnSelectOption {
  /** Source light-DOM node; also used to keep option ids stable. */
  node: Element;
  /** Plain text used by the typeahead search. */
  text: string;
  /** Markup mirrored into the list item (author HTML or escaped text). */
  html: string;
  /** Stable element id referenced by `aria-activedescendant`. */
  id: string;
}

let selectUid = 0;

function toCamelCase(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function oneOf<T extends string>(allowed: readonly T[], value: string, fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text used inside an attribute value or element content. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char: string) => HTML_ESCAPES[char] ?? char);
}

/** Parses a comma-separated `values` attribute. */
function parseValuesAttribute(value: string | null): string[] {
  if (value === null) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Normalizes a selection list: no empty values, no duplicates, at most one in single mode. */
function normalizeValues(input: Iterable<string>, multiple: boolean): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of input) {
    const value = String(raw);
    if (value === '' || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
    if (!multiple) break;
  }
  return next;
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

/**
 * `<an-select>` — a self-drawn listbox with a light-DOM option source.
 *
 * The author writes `<an-option>` (or plain `<option>`) children; the element
 * reads them through a `MutationObserver` and mirrors them into its own
 * `role="listbox"` panel. Focus never enters the list: the trigger stays a
 * `role="combobox"` and points at the active row through
 * `aria-activedescendant`, so keyboard interaction survives shadow re-renders.
 *
 * @attr {string} label - Visible label above the trigger. Default: empty.
 * @attr {string} placeholder - Text shown while nothing is selected. Default: empty.
 * @attr {'sm'|'md'|'lg'} size - Control size. Default: `md`.
 * @attr {string} name - Form field name. Default: empty.
 * @attr {boolean} disabled - Blocks interaction and form submission. Default: false.
 * @attr {boolean} required - Marks the field as mandatory. Default: false.
 * @attr {boolean} invalid - Applies the invalid styling and `aria-invalid`. Default: false.
 * @attr {string} value - Initial/current single value. The property never writes back the attribute.
 * @attr {string} values - Multi-select values, comma separated.
 * @attr {boolean} multiple - Turns the control into a multi-select. Default: false.
 * @attr {boolean} searchable - Renders a local search box in the panel. Default: false.
 * @attr {boolean} loading - Shows the loading row. Default: false.
 * @attr {'auto'|'on'|'off'} virtual - Virtualization mode. Default: `auto`.
 * @attr {number} max-tags - Tags shown on a multi-select trigger before `+N`. Default: 3.
 * @attr {boolean} open - Whether the panel is open. Reflected by the property.
 *
 * @fires an-select-change - User changed the selection. Detail: `{ value, values, option, originalEvent }`.
 * @fires an-select-open - The panel opened.
 * @fires an-select-close - The panel closed.
 * @fires an-search - Debounced search query. Detail: `{ query }`.
 *
 * @slot - `<an-option>` or native `<option>` children; they stay in the light DOM.
 *
 * @csspart base - Column wrapper around the label and the control.
 * @csspart label - Visible label.
 * @csspart trigger - The combobox trigger.
 * @csspart placeholder - Placeholder text slot.
 * @csspart tags - Tag container on a multi-select trigger.
 * @csspart tag - One selected tag.
 * @csspart tag-remove - The tag remove button.
 * @csspart panel - The floating panel.
 * @csspart search - The search input.
 * @csspart listbox - The `role="listbox"` scroller.
 * @csspart option - One list item.
 * @csspart option-indicator - The selected check mark.
 * @csspart empty - The no-results row.
 * @csspart loading - The loading row.
 *
 * @cssproperty --an-select-height - Trigger height.
 * @cssproperty --an-select-bg - Trigger background.
 * @cssproperty --an-select-fg - Trigger foreground.
 * @cssproperty --an-select-border-color - Border colour.
 * @cssproperty --an-select-radius - Corner radius.
 * @cssproperty --an-select-font-size - Font size.
 * @cssproperty --an-select-padding-x - Horizontal padding.
 * @cssproperty --an-select-focus-ring - Focus ring colour.
 * @cssproperty --an-select-panel-bg - Panel background.
 * @cssproperty --an-select-panel-max-height - Listbox max height.
 * @cssproperty --an-select-min-width - Minimum control width.
 */
export class AnSelect extends AnElement {
  static override styles: string = selectStyles;

  static override formAssociated = true;

  static override defaults = {
    label: '',
    placeholder: '',
    size: 'md',
    name: '',
    disabled: false,
    required: false,
    invalid: false,
    multiple: false,
    searchable: false,
    loading: false,
    virtual: 'auto',
    maxTags: 3,
  };

  /**
   * `value`, `values` and `open` are managed by hand: `value`/`values` seed the
   * selection without writing the attribute back, and `open` needs to drive the
   * popover instead of a plain re-render.
   */
  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'value',
      'values',
      'open',
      'aria-label',
      'aria-labelledby',
    ];
  }

  declare label: string;
  declare placeholder: string;
  declare size: AnSelectSize;
  declare name: string;
  declare disabled: boolean;
  declare required: boolean;
  declare invalid: boolean;
  declare multiple: boolean;
  declare searchable: boolean;
  declare loading: boolean;
  declare virtual: AnSelectVirtual;
  declare maxTags: number;

  readonly #uid: string;
  readonly #triggerId: string;
  readonly #panelId: string;
  readonly #listboxId: string;
  readonly #labelId: string;

  /** Selected values; the single value lives at index 0. */
  #values: string[] = [];
  /** True once a value/values attribute or property supplied the selection. */
  #selectionSeeded = false;
  /** Reset target, captured on the first connected render. */
  #initialValues: string[] = [];
  #initialCaptured = false;

  #open = false;
  #query = '';
  #composing = false;
  #pendingMutationRender = false;

  #allOptions: OptionRecord[] = [];
  #visible: OptionRecord[] = [];
  #activeIndex = -1;
  #scrollTop = 0;
  #pendingScrollTop: number | null = null;
  #pendingFocus: 'trigger' | 'search' | null = null;
  #pendingCaret: number | null = null;

  #searchTimer: ReturnType<typeof setTimeout> | null = null;
  #typeahead = '';
  #typeaheadTimer: ReturnType<typeof setTimeout> | null = null;

  #observer: MutationObserver | null = null;
  #popover: AnPopover | null = null;
  #formDisabled = false;
  #reflectingOpen = false;

  #nodeIds = new WeakMap<Element, string>();
  #nodeSeq = 0;

  #triggerEl: HTMLElement | null = null;
  #panelEl: HTMLElement | null = null;
  #listboxEl: HTMLElement | null = null;
  #searchEl: HTMLInputElement | null = null;
  #emptyEl: HTMLElement | null = null;
  #loadingEl: HTMLElement | null = null;

  constructor() {
    super();
    this.#uid = `an-select-${++selectUid}`;
    this.#triggerId = `${this.#uid}-trigger`;
    this.#panelId = `${this.#uid}-panel`;
    this.#listboxId = `${this.#uid}-listbox`;
    this.#labelId = `${this.#uid}-label`;

    this.addEventListener('click', this.#onClick);
    this.addEventListener('keydown', this.#onKeyDown);
    this.addEventListener('input', this.#onInput);
    this.addEventListener('compositionstart', this.#onCompositionStart);
    this.addEventListener('compositionend', this.#onCompositionEnd);
  }

  /** Current single value; `''` while nothing is selected. */
  get value(): string {
    return this.#values[0] ?? '';
  }

  /** Seeds the current value without reflecting it back onto the attribute. */
  set value(next: string) {
    this.#seed([String(next)]);
  }

  /** Current selection as a list; single-selects expose at most one entry. */
  get values(): string[] {
    return [...this.#values];
  }

  /** Seeds the selection from an array or a comma-separated string. */
  set values(next: string[] | string) {
    this.#seed(Array.isArray(next) ? next.map(String) : parseValuesAttribute(next));
  }

  /** Whether the panel is open. */
  get open(): boolean {
    return this.#open;
  }

  /** Opens or closes the panel programmatically. */
  set open(next: boolean) {
    this.#setOpen(Boolean(next));
  }

  /** Alias for `open`, matching the other overlay components. */
  get isOpen(): boolean {
    return this.#open;
  }

  /** A live snapshot of the light-DOM options. */
  get options(): AnSelectOption[] {
    return this.#readOptions().map(({ value, label, disabled }) => ({ value, label, disabled }));
  }

  /** Opens the panel. */
  show(): void {
    this.#setOpen(true);
  }

  /** Closes the panel. */
  close(): void {
    this.#setOpen(false);
  }

  /** Toggles the panel. */
  toggle(): void {
    this.#setOpen(!this.#open);
  }

  /** Selects every enabled option (single-selects pick the first one). */
  selectAll(): void {
    const pickable = this.#readOptions().filter(
      (option) => !option.disabled && option.value !== '',
    );
    const next = this.multiple
      ? pickable.map((option) => option.value)
      : pickable.slice(0, 1).map((option) => option.value);
    this.#commitProgrammatic(normalizeValues(next, this.multiple));
  }

  /** Clears the selection. */
  clear(): void {
    this.#commitProgrammatic([]);
  }

  /** Serializes the current selection the way `new FormData(form)` would. */
  override getFormData(): FormData | null {
    return super.getFormData();
  }

  /**
   * Constraint validation. Falls back to `internals.validity` on DOM shims that
   * expose `setValidity()` but not `checkValidity()`.
   */
  override checkValidity(): boolean {
    const internals = this.internals;
    if (internals === null) return true;
    if (typeof internals.checkValidity === 'function') return internals.checkValidity();
    return internals.validity?.valid ?? true;
  }

  /** Like `checkValidity()`, but emits `invalid` before reporting failure. */
  override reportValidity(): boolean {
    const internals = this.internals;
    if (internals !== null && typeof internals.reportValidity === 'function') {
      return internals.reportValidity();
    }
    if (this.checkValidity()) return true;
    this.dispatchEvent(new Event('invalid', { cancelable: true }));
    return false;
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    value: string | null,
  ): void {
    if (oldValue === value) return;

    if (name === 'value') {
      if (oldValue === value) return;
      this.#seed(value === null ? [] : [value]);
      return;
    }
    if (name === 'values') {
      if (oldValue === value) return;
      this.#seed(parseValuesAttribute(value));
      return;
    }
    if (name === 'open') {
      if (this.#reflectingOpen || oldValue === value) return;
      this.#setOpen(value !== null, { focus: false });
      return;
    }
    if (name === 'aria-label' || name === 'aria-labelledby') {
      if (oldValue !== value) this.requestUpdate();
      return;
    }
    if (name === 'multiple' && oldValue !== value) {
      this.#values = normalizeValues(this.#values, value !== null);
    }
    super.attributeChangedCallback(name, oldValue, value);
  }

  /** Re-renders while remembering focus, caret and scroll position. */
  override requestUpdate(): void {
    const root = this.shadowRoot;
    const active = root?.activeElement ?? null;
    const trigger = this.#triggerEl;
    const search = this.#searchEl;
    if (active !== null && search !== null && active === search) {
      this.#pendingFocus = 'search';
      this.#pendingCaret = search.selectionStart;
    } else if (active !== null && trigger !== null && trigger.contains(active)) {
      this.#pendingFocus = 'trigger';
      this.#pendingCaret = null;
    } else {
      this.#pendingFocus = null;
      this.#pendingCaret = null;
    }
    const list = this.#listboxEl;
    if (list !== null) {
      this.#scrollTop = list.scrollTop;
      this.#pendingScrollTop = list.scrollTop;
    }
    super.requestUpdate();
  }

  protected override onConnect(): void {
    this.#observer = new MutationObserver(this.#onMutations);
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }

  protected override onDisconnect(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#destroyPopover();
    this.#cancelSearchTimer();
    this.#cancelTypeahead();
  }

  protected override onFormReset(): void {
    this.#values = [...this.#initialValues];
    this.#selectionSeeded = true;
    this.#query = '';
    this.#activeIndex = -1;
    if (this.#searchEl !== null) this.#searchEl.value = '';
    this.#applyFilter();
    this.requestUpdate();
  }

  protected override onFormDisabled(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.requestUpdate();
  }

  protected override formEntries(): Array<[string, string]> {
    if (this.#isDisabled() || this.name.length === 0 || this.#values.length === 0) return [];
    return this.#values.map((value) => [this.name, value] as [string, string]);
  }

  protected override render(): string {
    this.#refreshOptions();

    const disabled = this.#isDisabled();
    const label = this.label;
    const labelMarkup =
      label.length > 0
        ? `<label class="label" part="label" id="${this.#labelId}" for="${this.#triggerId}">` +
          `<span class="label-text">${escapeHtml(label)}</span></label>`
        : '';

    return (
      `<div class="base" part="base">` +
      `${labelMarkup}` +
      `<div class="control">` +
      `${this.#triggerMarkup(disabled)}` +
      `${this.#panelMarkup()}` +
      `</div>` +
      `</div>`
    );
  }

  protected override afterRender(): void {
    const root = this.shadowRoot;
    this.#triggerEl = (root?.querySelector('[part~="trigger"]') as HTMLElement | null) ?? null;
    this.#panelEl = (root?.querySelector('[part~="panel"]') as HTMLElement | null) ?? null;
    this.#listboxEl = (root?.querySelector('[part~="listbox"]') as HTMLElement | null) ?? null;
    this.#searchEl = (root?.querySelector('[part~="search"]') as HTMLInputElement | null) ?? null;
    this.#emptyEl = (root?.querySelector('[part~="empty"]') as HTMLElement | null) ?? null;
    this.#loadingEl = (root?.querySelector('[part~="loading"]') as HTMLElement | null) ?? null;

    if (
      !this.#initialCaptured &&
      (this.#selectionSeeded || this.#allOptions.length > 0)
    ) {
      this.#captureInitial();
    }

    if (this.#isDisabled() && this.#open) this.#setOpen(false, { focus: false });

    this.#applyPendingScroll();
    this.#bindListScroll();

    if (this.#open) {
      if (this.#activeIndex < 0 || this.#activeIndex >= this.#visible.length) this.#initActive();
      this.#paintList();
      this.#openPopover();
    } else {
      this.#destroyPopover();
    }

    this.#applyPendingFocus();
    this.#syncForm();
    this.#reflectHostState();
  }

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------

  #triggerMarkup(disabled: boolean): string {
    const describedBy = this.getAttribute('aria-labelledby');
    const ariaLabel = this.getAttribute('aria-label');
    const labelledBy = this.label.length > 0 ? this.#labelId : describedBy;
    const accessibility =
      (labelledBy !== null ? ` aria-labelledby="${escapeHtml(labelledBy)}"` : '') +
      (labelledBy === null && ariaLabel !== null ? ` aria-label="${escapeHtml(ariaLabel)}"` : '') +
      (this.required ? ' aria-required="true"' : '') +
      (this.invalid ? ' aria-invalid="true"' : '') +
      (disabled ? ' aria-disabled="true"' : '');
    const active = this.#open ? this.#visible[this.#activeIndex] : undefined;
    const activeDescendant =
      active !== undefined ? ` aria-activedescendant="${active.id}"` : '';

    return (
      `<div class="trigger${this.#open ? ' is-open' : ''}" part="trigger"` +
      ` id="${this.#triggerId}"` +
      ` role="combobox"` +
      ` aria-haspopup="listbox"` +
      ` aria-expanded="${this.#open ? 'true' : 'false'}"` +
      ` aria-controls="${this.#listboxId}"` +
      `${activeDescendant}` +
      `${accessibility}` +
      ` tabindex="${disabled ? '-1' : '0'}">` +
      `${this.#triggerContent()}` +
      `<span class="chevron" aria-hidden="true"></span>` +
      `</div>`
    );
  }

  #triggerContent(): string {
    if (this.multiple) {
      const selected = this.#selectedViews();
      const limit = Math.max(0, Math.floor(this.maxTags));
      const shown = selected.slice(0, limit);
      const extra = selected.length - shown.length;
      const tags =
        shown
          .map(
            (view, index) =>
              `<span class="tag" part="tag">` +
              `<span class="tag-label">${escapeHtml(view.label)}</span>` +
              `<button type="button" class="tag-remove" part="tag-remove"` +
              ` data-tag-remove data-tag-index="${index}" tabindex="-1"` +
              ` aria-label="移除 ${escapeHtml(view.label)}">×</button>` +
              `</span>`,
          )
          .join('') + (extra > 0 ? `<span class="tag-overflow">+${extra}</span>` : '');
      return (
        `<span class="tags" part="tags"${selected.length === 0 ? ' hidden' : ''}>${tags}</span>` +
        this.#placeholderMarkup(selected.length > 0)
      );
    }

    const selected = this.#selectedViews()[0];
    const label = selected === undefined ? '' : selected.label;
    return (
      `<span class="value">${escapeHtml(label)}</span>` +
      this.#placeholderMarkup(selected !== undefined)
    );
  }

  #placeholderMarkup(hidden: boolean): string {
    return `<span class="placeholder" part="placeholder"${hidden ? ' hidden' : ''}>${escapeHtml(
      this.placeholder,
    )}</span>`;
  }

  #panelMarkup(): string {
    const visible = this.#visible;
    const loading = this.loading;
    const empty = visible.length === 0 && !loading;
    const searchMarkup = this.searchable
      ? `<div class="search-wrap">` +
        `<input class="search" part="search" type="search" placeholder="搜索…"` +
        ` aria-label="搜索" aria-controls="${this.#listboxId}"` +
        ` autocomplete="off" spellcheck="false" value="${escapeHtml(this.#query)}">` +
        `</div>`
      : '';

    return (
      `<div class="panel" part="panel" id="${this.#panelId}"${this.#open ? '' : ' hidden'}>` +
      `${searchMarkup}` +
      `<div class="listbox" part="listbox" id="${this.#listboxId}" role="listbox"` +
      `${this.multiple ? ' aria-multiselectable="true"' : ''}>` +
      `${this.#optionsMarkup()}` +
      `</div>` +
      `<div class="empty" part="empty"${empty ? '' : ' hidden'}>无匹配项</div>` +
      `<div class="loading" part="loading"${loading ? '' : ' hidden'}>` +
      `<span class="spinner" aria-hidden="true"></span>加载中…</div>` +
      `</div>`
    );
  }

  #optionsMarkup(): string {
    const total = this.#visible.length;
    if (total === 0) return '';
    const window = this.#virtualWindow();
    let rows = '';
    for (let index = window.start; index < window.end; index += 1) {
      rows += this.#optionMarkup(index);
    }
    if (!this.#virtualEnabled()) return rows;
    // Keep the highlighted row in the DOM even when the user has scrolled the
    // viewport away from it, so `aria-activedescendant` still resolves.
    const activeOutside =
      this.#open &&
      this.#activeIndex >= 0 &&
      (this.#activeIndex < window.start || this.#activeIndex >= window.end);
    const activeRow = activeOutside
      ? `<div class="virtual-active" style="top:${this.#activeIndex * ITEM_HEIGHT}px">` +
        `${this.#optionMarkup(this.#activeIndex)}</div>`
      : '';
    return (
      `<div class="virtual-spacer" style="height:${total * ITEM_HEIGHT}px">` +
      `<div class="virtual-window" style="top:${window.start * ITEM_HEIGHT}px">` +
      `${rows}</div>${activeRow}</div>`
    );
  }

  #optionMarkup(index: number): string {
    const option = this.#visible[index];
    if (option === undefined) return '';
    const selected = this.#values.includes(option.value);
    const active = index === this.#activeIndex;
    return (
      `<div class="option" part="option" id="${option.id}" role="option"` +
      ` data-option-index="${index}"` +
      ` aria-selected="${selected ? 'true' : 'false'}"` +
      `${option.disabled ? ' aria-disabled="true"' : ''}` +
      ` aria-posinset="${index + 1}" aria-setsize="${this.#visible.length}"` +
      `${active ? ' data-active="true"' : ''}>` +
      `<span class="option-content">${option.html}</span>` +
      `<span class="option-indicator" part="option-indicator" aria-hidden="true">✓</span>` +
      `</div>`
    );
  }

  // ---------------------------------------------------------------------------
  // Options
  // ---------------------------------------------------------------------------

  #readOptions(): OptionRecord[] {
    const options: OptionRecord[] = [];
    for (const child of Array.from(this.children)) {
      if (child.localName === 'an-option') {
        const element = child as Element & Partial<AnOption>;
        const text = (child.textContent ?? '').trim();
        const value =
          typeof element.value === 'string'
            ? element.value
            : (child.getAttribute('value') ?? text);
        const label =
          typeof element.label === 'string' && element.label.trim() !== ''
            ? element.label
            : text || value;
        const disabled = child.hasAttribute('disabled') || element.disabled === true;
        const inner = child.innerHTML.trim();
        options.push({
          node: child,
          value,
          label,
          text: text || value,
          disabled,
          html: inner.length > 0 ? child.innerHTML : escapeHtml(text || label),
          id: this.#optionId(child),
        });
      } else if (child.localName === 'option') {
        const element = child as HTMLOptionElement;
        const text = (child.textContent ?? '').trim();
        const value = child.getAttribute('value') ?? text;
        const label = element.label || text || value;
        options.push({
          node: child,
          value,
          label,
          text: text || value,
          disabled: element.disabled === true || child.hasAttribute('disabled'),
          html: escapeHtml(text || label),
          id: this.#optionId(child),
        });
      }
    }
    return options;
  }

  #optionId(node: Element): string {
    let id = this.#nodeIds.get(node);
    if (id === undefined) {
      this.#nodeSeq += 1;
      id = `${this.#uid}-option-${this.#nodeSeq}`;
      this.#nodeIds.set(node, id);
    }
    return id;
  }

  #refreshOptions(): void {
    this.#allOptions = this.#readOptions();
    if (!this.#selectionSeeded && !this.#initialCaptured && this.#allOptions.length > 0) {
      const first = this.#allOptions.find((option) => !option.disabled && option.value !== '');
      this.#values =
        this.multiple || this.placeholder.length > 0 || first === undefined ? [] : [first.value];
      this.#selectionSeeded = true;
    }
    if (this.#initialCaptured) this.#pruneSelection();
    this.#applyFilter();
  }

  #pruneSelection(): void {
    const available = new Set(this.#allOptions.map((option) => option.value));
    const next = this.#values.filter((value) => available.has(value));
    if (!sameList(next, this.#values)) this.#values = next;
  }

  #applyFilter(): void {
    const query = this.#query.trim().toLowerCase();
    this.#visible =
      query.length === 0
        ? [...this.#allOptions]
        : this.#allOptions.filter((option) => this.#matches(option, query));
    if (this.#activeIndex >= this.#visible.length) this.#activeIndex = this.#visible.length - 1;
  }

  #matches(option: OptionRecord, query: string): boolean {
    return (
      option.label.toLowerCase().includes(query) ||
      option.text.toLowerCase().includes(query) ||
      option.value.toLowerCase().includes(query)
    );
  }

  #selectedViews(): AnSelectOption[] {
    return this.#values.map((value) => {
      const option = this.#allOptions.find((candidate) => candidate.value === value);
      return option === undefined
        ? { value, label: value, disabled: false }
        : { value: option.value, label: option.label, disabled: option.disabled };
    });
  }

  #captureInitial(): void {
    this.#initialValues = [...this.#values];
    this.#initialCaptured = true;
  }

  // ---------------------------------------------------------------------------
  // Open / close
  // ---------------------------------------------------------------------------

  #setOpen(next: boolean, options: { focus?: boolean; emit?: boolean } = {}): void {
    const focus = options.focus ?? true;
    const emit = options.emit ?? true;
    if (next && this.#isDisabled()) return;
    if (next === this.#open) {
      if (next && focus) this.#triggerEl?.focus();
      return;
    }

    this.#open = next;
    this.#reflectingOpen = true;
    this.toggleAttribute('open', next);
    this.#reflectingOpen = false;

    if (next) {
      this.#query = '';
      if (this.#searchEl !== null) this.#searchEl.value = '';
      this.#refreshOptions();
      this.#initActive();
      this.#panelEl?.removeAttribute('hidden');
      this.#triggerEl?.setAttribute('aria-expanded', 'true');
      this.#triggerEl?.classList.add('is-open');
      this.#paintList(true);
      this.#openPopover();
      if (focus) this.#triggerEl?.focus();
    } else {
      this.#destroyPopover();
      this.#cancelSearchTimer();
      this.#query = '';
      this.#activeIndex = -1;
      if (this.#searchEl !== null) this.#searchEl.value = '';
      this.#applyFilter();
      this.#panelEl?.setAttribute('hidden', '');
      this.#triggerEl?.setAttribute('aria-expanded', 'false');
      this.#triggerEl?.classList.remove('is-open');
      this.#triggerEl?.removeAttribute('aria-activedescendant');
      this.#paintList(true);
      if (focus) this.#triggerEl?.focus();
    }

    if (emit && this.isConnected) {
      this.emit(next ? 'an-select-open' : 'an-select-close');
    }
  }

  #openPopover(): void {
    this.#destroyPopover();
    if (!this.#open) return;
    const anchor = this.#triggerEl;
    const floating = this.#panelEl;
    if (anchor === null || floating === null) return;
    this.#popover = new AnPopover({
      anchor,
      floating,
      matchWidth: true,
      offset: 4,
      onClose: this.#onPopoverClose,
    });
    this.#popover.open();
  }

  #destroyPopover(): void {
    const popover = this.#popover;
    this.#popover = null;
    popover?.destroy();
  }

  #onPopoverClose = (): void => {
    if (!this.#open) return;
    this.#setOpen(false, { focus: false });
  };

  // ---------------------------------------------------------------------------
  // List painting and virtualization
  // ---------------------------------------------------------------------------

  #virtualEnabled(): boolean {
    const mode = oneOf(VIRTUAL_MODES, String(this.virtual), 'auto');
    if (mode === 'off') return false;
    if (mode === 'on') return true;
    return this.#visible.length > 200;
  }

  #virtualWindow(): { start: number; end: number } {
    const total = this.#visible.length;
    if (!this.#virtualEnabled()) return { start: 0, end: total };
    const viewport = this.#listboxEl?.clientHeight ?? 0;
    const height = viewport > 0 ? viewport : VIRTUAL_VIEWPORT;
    const first = Math.floor(this.#scrollTop / ITEM_HEIGHT);
    const perPage = Math.max(1, Math.ceil(height / ITEM_HEIGHT));
    const start = Math.max(0, first - VIRTUAL_BUFFER);
    let end = Math.min(total, first + perPage + VIRTUAL_BUFFER);
    if (end <= start) end = Math.min(total, start + 1);
    return { start, end };
  }

  #paintList(resetScroll = false): void {
    const list = this.#listboxEl;
    if (list === null) return;
    if (resetScroll) {
      this.#scrollTop = 0;
      list.scrollTop = 0;
    } else {
      this.#scrollTop = list.scrollTop;
    }
    list.innerHTML = this.#optionsMarkup();
    list.scrollTop = this.#scrollTop;
    this.#updateStatus();
    this.#syncActiveDescendant();
  }

  #updateStatus(): void {
    const loading = this.loading;
    if (this.#loadingEl !== null) this.#loadingEl.toggleAttribute('hidden', !loading);
    if (this.#emptyEl !== null) {
      this.#emptyEl.toggleAttribute('hidden', loading || this.#visible.length > 0);
    }
  }

  #syncActiveDescendant(): void {
    const trigger = this.#triggerEl;
    if (trigger === null) return;
    const active = this.#open ? this.#visible[this.#activeIndex] : undefined;
    if (active === undefined) trigger.removeAttribute('aria-activedescendant');
    else trigger.setAttribute('aria-activedescendant', active.id);
  }

  #bindListScroll(): void {
    const list = this.#listboxEl;
    if (list === null) return;
    list.addEventListener('scroll', this.#onScroll, { passive: true });
  }

  #onScroll = (): void => {
    const list = this.#listboxEl;
    if (list === null) return;
    const next = list.scrollTop;
    if (next === this.#scrollTop) return;
    this.#scrollTop = next;
    if (this.#virtualEnabled()) this.#paintList();
  };

  #initActive(): void {
    const selected = this.#values[0];
    let index =
      selected === undefined
        ? -1
        : this.#visible.findIndex((option) => option.value === selected && !option.disabled);
    if (index < 0) index = this.#firstEnabled();
    this.#activeIndex = index;
  }

  #firstEnabled(): number {
    return this.#visible.findIndex((option) => !option.disabled);
  }

  #setActive(index: number): void {
    this.#activeIndex = index;
    this.#scrollActiveIntoView();
    this.#paintList();
  }

  #moveActive(delta: number): void {
    const total = this.#visible.length;
    if (total === 0) return;
    const direction = delta >= 0 ? 1 : -1;
    let index = this.#activeIndex;
    let remaining = Math.abs(delta);
    let moved = false;
    while (remaining > 0) {
      const next = this.#nextEnabled(index, direction);
      if (next === index && moved) break;
      index = next;
      moved = true;
      remaining -= 1;
    }
    if (index >= 0) this.#setActive(index);
  }

  #nextEnabled(index: number, direction: number): number {
    const total = this.#visible.length;
    let cursor = index;
    for (let step = 0; step < total; step += 1) {
      if (cursor < 0) cursor = direction > 0 ? 0 : total - 1;
      else cursor = direction > 0 ? (cursor + 1) % total : (cursor - 1 + total) % total;
      if (!this.#visible[cursor].disabled) return cursor;
    }
    return index;
  }

  #scrollActiveIntoView(): void {
    const index = this.#activeIndex;
    const list = this.#listboxEl;
    if (index < 0 || list === null) return;
    const viewport = list.clientHeight > 0 ? list.clientHeight : VIRTUAL_VIEWPORT;
    const top = index * ITEM_HEIGHT;
    const bottom = top + ITEM_HEIGHT;
    let scrollTop = list.scrollTop;
    if (top < scrollTop) scrollTop = top;
    else if (bottom > scrollTop + viewport) scrollTop = bottom - viewport;
    list.scrollTop = scrollTop;
    this.#scrollTop = list.scrollTop;
  }

  #applyPendingScroll(): void {
    const top = this.#pendingScrollTop;
    this.#pendingScrollTop = null;
    if (top === null || this.#listboxEl === null) return;
    this.#listboxEl.scrollTop = top;
    this.#scrollTop = this.#listboxEl.scrollTop;
  }

  #applyPendingFocus(): void {
    const focus = this.#pendingFocus;
    const caret = this.#pendingCaret;
    this.#pendingFocus = null;
    this.#pendingCaret = null;
    if (focus === 'search' && this.#open && this.#searchEl !== null) {
      this.#searchEl.focus();
      const position = caret ?? this.#query.length;
      try {
        this.#searchEl.setSelectionRange(position, position);
      } catch {
        // Some DOM shims do not implement selection ranges on search inputs.
      }
    } else if (focus !== null && this.#triggerEl !== null) {
      this.#triggerEl.focus();
    }
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  #seed(input: Iterable<string>): void {
    this.#values = normalizeValues(input, this.multiple);
    this.#selectionSeeded = true;
    if (this.#open) this.#initActive();
    this.requestUpdate();
  }

  #commitProgrammatic(next: string[]): void {
    if (sameList(next, this.#values)) return;
    this.#values = [...next];
    this.#selectionSeeded = true;
    if (this.#open) this.#initActive();
    this.requestUpdate();
  }

  #selectOption(option: OptionRecord, originalEvent: Event | null): void {
    const before = this.#values;
    const next = this.multiple
      ? before.includes(option.value)
        ? before.filter((value) => value !== option.value)
        : [...before, option.value]
      : [option.value];
    const normalized = normalizeValues(next, this.multiple);
    const changed = !sameList(before, normalized);
    const searchFocused =
      this.#searchEl !== null && this.shadowRoot?.activeElement === this.#searchEl;

    this.#values = normalized;
    this.#selectionSeeded = true;

    if (!this.multiple) this.#setOpen(false, { focus: false });
    this.requestUpdate();
    if (!this.multiple || !searchFocused) this.#triggerEl?.focus();
    if (changed) this.#emitChange(originalEvent, option);
  }

  #removeTag(index: number, originalEvent: Event | null): void {
    const value = this.#values[index];
    if (value === undefined) return;
    const option = this.#allOptions.find((candidate) => candidate.value === value) ?? null;
    this.#values = this.#values.filter((_, position) => position !== index);
    this.#selectionSeeded = true;
    this.requestUpdate();
    this.#triggerEl?.focus();
    this.#emitChange(originalEvent, option);
  }

  #removeLastTag(originalEvent: Event): void {
    this.#removeTag(this.#values.length - 1, originalEvent);
  }

  #emitChange(originalEvent: Event | null, option: OptionRecord | AnSelectOption | null): void {
    this.emit('an-select-change', {
      value: this.value,
      values: [...this.#values],
      option:
        option === null
          ? null
          : { value: option.value, label: option.label, disabled: option.disabled },
      originalEvent,
    });
  }

  // ---------------------------------------------------------------------------
  // Form state
  // ---------------------------------------------------------------------------

  #syncForm(): void {
    const internals = this.internals;
    if (internals === null) return;

    if (this.#isDisabled()) {
      internals.setFormValue(null);
      internals.setValidity({});
      return;
    }

    if (this.#values.length === 0 || this.name.length === 0) {
      internals.setFormValue(null);
    } else if (this.multiple) {
      const data = new FormData();
      for (const value of this.#values) data.append(this.name, value);
      internals.setFormValue(data);
    } else {
      internals.setFormValue(this.#values[0]);
    }

    if (this.required && this.#values.length === 0) {
      internals.setValidity(
        { valueMissing: true },
        REQUIRED_MESSAGE,
        this.#triggerEl ?? undefined,
      );
    } else {
      internals.setValidity({});
    }
  }

  #reflectHostState(): void {
    const disabled = this.#isDisabled();
    if (this.required) this.setAttribute('aria-required', 'true');
    else this.removeAttribute('aria-required');
    if (this.invalid) this.setAttribute('aria-invalid', 'true');
    else this.removeAttribute('aria-invalid');
    if (disabled) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
  }

  #isDisabled(): boolean {
    return Boolean(this.disabled) || this.#formDisabled;
  }

  // ---------------------------------------------------------------------------
  // Observers and search
  // ---------------------------------------------------------------------------

  #onMutations = (records: MutationRecord[]): void => {
    let relevant = false;
    for (const record of records) {
      if (record.type === 'attributes' && record.target === this) continue;
      relevant = true;
      break;
    }
    if (!relevant) return;
    if (this.#composing) {
      this.#pendingMutationRender = true;
      return;
    }
    this.requestUpdate();
  };

  #onInput = (event: Event): void => {
    const input = this.#searchEl;
    if (input === null || !event.composedPath().includes(input)) return;
    if (this.#composing) return;
    this.#query = input.value;
    this.#applyFilter();
    this.#activeIndex = this.#firstEnabled();
    this.#paintList(true);
    this.#scheduleSearch(input.value);
  };

  #onCompositionStart = (event: Event): void => {
    const input = this.#searchEl;
    if (input === null || !event.composedPath().includes(input)) return;
    this.#composing = true;
  };

  #onCompositionEnd = (event: Event): void => {
    const input = this.#searchEl;
    if (input === null || !event.composedPath().includes(input)) return;
    this.#composing = false;
    this.#query = input.value;
    this.#applyFilter();
    this.#activeIndex = this.#firstEnabled();
    this.#paintList(true);
    if (this.#pendingMutationRender) {
      this.#pendingMutationRender = false;
      this.requestUpdate();
    }
    this.#scheduleSearch(input.value);
  };

  #scheduleSearch(query: string): void {
    this.#cancelSearchTimer();
    this.#searchTimer = setTimeout(() => {
      this.#searchTimer = null;
      if (!this.isConnected) return;
      this.emit('an-search', { query });
    }, SEARCH_DEBOUNCE);
  }

  #cancelSearchTimer(): void {
    if (this.#searchTimer === null) return;
    clearTimeout(this.#searchTimer);
    this.#searchTimer = null;
  }

  #cancelTypeahead(): void {
    if (this.#typeaheadTimer === null) return;
    clearTimeout(this.#typeaheadTimer);
    this.#typeaheadTimer = null;
    this.#typeahead = '';
  }

  #handleTypeahead(key: string, event: KeyboardEvent): boolean {
    if (key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return false;
    this.#typeahead += key.toLowerCase();
    if (this.#typeaheadTimer !== null) clearTimeout(this.#typeaheadTimer);
    this.#typeaheadTimer = setTimeout(() => {
      this.#typeaheadTimer = null;
      this.#typeahead = '';
    }, TYPEAHEAD_TIMEOUT);

    if (!this.#open) this.#setOpen(true);
    const query = this.#typeahead;
    const total = this.#visible.length;
    if (total === 0) return true;

    const start = query.length === 1 && this.#activeIndex >= 0 ? this.#activeIndex : -1;
    for (let offset = 0; offset < total; offset += 1) {
      const index = start < 0 ? offset : (start + offset + 1) % total;
      const option = this.#visible[index];
      if (option.disabled) continue;
      const haystack = `${option.label} ${option.text} ${option.value}`.toLowerCase();
      if (haystack.includes(query)) {
        this.#setActive(index);
        return true;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  #onClick = (event: MouseEvent): void => {
    if (this.#isDisabled()) return;
    const path = event.composedPath();

    for (const node of path) {
      if (!(node instanceof HTMLElement)) continue;
      if (!node.hasAttribute('data-tag-remove')) continue;
      const index = Number(node.dataset.tagIndex);
      if (!Number.isNaN(index)) this.#removeTag(index, event);
      return;
    }

    for (const node of path) {
      if (!(node instanceof HTMLElement)) continue;
      if (!node.hasAttribute('data-option-index')) continue;
      if (node.getAttribute('aria-disabled') === 'true') return;
      const index = Number(node.dataset.optionIndex);
      const option = this.#visible[index];
      if (option !== undefined) this.#selectOption(option, event);
      return;
    }

    if (this.#triggerEl !== null && path.includes(this.#triggerEl)) {
      this.#setOpen(!this.#open);
    }
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    const path = event.composedPath();
    const trigger = this.#triggerEl;
    const search = this.#searchEl;
    const inSearch = search !== null && path.includes(search);
    const inTrigger = trigger !== null && path.includes(trigger);
    if (!inSearch && !inTrigger) return;

    const key = event.key;
    if (this.#isDisabled()) {
      if (key === 'Escape' && this.#open) this.#setOpen(false);
      return;
    }

    if (key === 'Escape') {
      if (this.#open) {
        this.#setOpen(false, { focus: true });
        this.#triggerEl?.focus();
        event.preventDefault();
      } else if (inSearch) {
        trigger?.focus();
      }
      return;
    }

    if (key === 'Tab') {
      if (this.#open) this.#setOpen(false, { focus: false });
      return;
    }

    if (inSearch) {
      // Home/End/Page keys edit the search text; only the list keys are ours.
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter') {
        event.preventDefault();
        if (!this.#open) this.#setOpen(true);
        else if (key === 'Enter') this.#activateActive(event);
        else this.#moveActive(key === 'ArrowDown' ? 1 : -1);
      }
      return;
    }

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        if (this.#open) this.#moveActive(1);
        else this.#setOpen(true);
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (this.#open) this.#moveActive(-1);
        else this.#setOpen(true);
        return;
      case 'Home':
        if (this.#open) {
          event.preventDefault();
          const first = this.#firstEnabled();
          if (first >= 0) this.#setActive(first);
        }
        return;
      case 'End':
        if (this.#open) {
          event.preventDefault();
          for (let index = this.#visible.length - 1; index >= 0; index -= 1) {
            if (!this.#visible[index].disabled) {
              this.#setActive(index);
              break;
            }
          }
        }
        return;
      case 'PageDown':
        if (this.#open) {
          event.preventDefault();
          this.#moveActive(10);
        }
        return;
      case 'PageUp':
        if (this.#open) {
          event.preventDefault();
          this.#moveActive(-10);
        }
        return;
      case 'Enter':
        event.preventDefault();
        if (this.#open) this.#activateActive(event);
        else this.#setOpen(true);
        return;
      case ' ':
        event.preventDefault();
        if (!this.#open) this.#setOpen(true);
        else this.#activateActive(event);
        return;
      case 'Backspace':
        if (this.multiple && this.#values.length > 0) {
          event.preventDefault();
          this.#removeLastTag(event);
        }
        return;
      default:
        if (this.#handleTypeahead(key, event)) event.preventDefault();
    }
  };

  #activateActive(originalEvent: Event): void {
    const option = this.#visible[this.#activeIndex];
    if (option === undefined || option.disabled) return;
    this.#selectOption(option, originalEvent);
  }
}

export { SIZES };
