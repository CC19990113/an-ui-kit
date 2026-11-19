import groupStyles from './an-option-group.css?inline';
import { AnElement } from '../internal/base';

/**
 * `<an-option-group>` — a labelled group of `<an-option>` children.
 *
 * The element renders nothing: `<an-select>` reads the `label` / `disabled`
 * state and the `<an-option>` children out of the light DOM, then paints the
 * whole list — group wrapper included — inside its own shadow root. Because the
 * host is `display:none` the markup stays authorable without JavaScript and
 * without being painted twice.
 *
 * ```html
 * <an-select searchable>
 *   <an-option-group label="华东">
 *     <an-option value="sh">上海</an-option>
 *     <an-option value="hz">杭州</an-option>
 *   </an-option-group>
 *   <an-option-group label="华北" disabled>
 *     <an-option value="bj">北京</an-option>
 *   </an-option-group>
 * </an-select>
 * ```
 *
 * @attr {string} label - Accessible name of the group; `<an-select>` renders it as the `aria-label` of the `role="group"` wrapper. Default: the trimmed text content when unset or empty.
 * @attr {boolean} disabled - Disables every `<an-option>` inside the group. Default: false.
 *
 * @slot - `<an-option>` children; they stay in the light DOM and are read by `<an-select>`.
 */
export class AnOptionGroup extends AnElement {
  static override styles: string = groupStyles;

  static override defaults = {
    label: '',
    disabled: false,
  };

  constructor() {
    super();
    // `AnElement` installs an own accessor for every `defaults` key, which would
    // shadow the prototype getter below. Drop it so `label` can fall back to the
    // text content while staying in `defaults` for the attribute wiring.
    delete (this as { label?: string }).label;
  }

  /** Accessible name; an empty `label` falls back to the trimmed text content. */
  get label(): string {
    const attribute = this.getAttribute('label');
    if (attribute !== null && attribute.trim() !== '') return attribute;
    // Only the group's own text nodes count: the text of the `<an-option>`
    // children names the options, never the group that contains them.
    let ownText = '';
    for (const node of Array.from(this.childNodes)) {
      if (node.nodeType === 3) ownText += node.textContent ?? '';
    }
    return ownText.trim();
  }

  set label(next: string) {
    if (String(next).trim() === '') this.removeAttribute('label');
    else this.setAttribute('label', String(next));
  }

  /** Disables every option the group contains, mirrored to the `disabled` attribute. */
  declare disabled: boolean;

  /** Groups are data for `<an-select>`; they never paint their own markup. */
  protected override render(): string {
    return '';
  }
}
