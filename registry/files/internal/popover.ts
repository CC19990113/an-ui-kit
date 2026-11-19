/**
 * Anchored floating panel used by the overlay components (select, date picker,
 * combobox). Framework-free and dependency-free.
 *
 * The panel is promoted to the top layer through `popover="manual"` +
 * `showPopover()` when the platform supports it, and falls back to plain
 * `position: fixed` when it does not. Position is computed from
 * `getBoundingClientRect()` (viewport coordinates) with a vertical flip when the
 * space below the anchor is too small and a horizontal shift that keeps the
 * panel inside the viewport.
 */

/** Viewport margin that the horizontal shift keeps free on both sides. */
const VIEWPORT_MARGIN = 8;

/** Options accepted by `AnPopover`. */
export interface AnPopoverOptions {
  /** Element the panel is anchored to. */
  anchor: HTMLElement;
  /** Panel element that gets shown next to the anchor. */
  floating: HTMLElement;
  /** Keep the panel at least as wide as the anchor. Default: `true`. */
  matchWidth?: boolean;
  /** Gap between anchor and panel, in pixels. Default: `4`. */
  offset?: number;
  /** Called after a dismissal (outside pointerdown / Escape) closed the panel. */
  onClose?: () => void;
}

/** Inline styles `AnPopover` writes, so `close()` can put them back. */
interface SavedStyles {
  position: string;
  top: string;
  left: string;
  minWidth: string;
  inset: string;
  margin: string;
}

/**
 * Positions and dismisses one floating panel.
 *
 * `open()` / `close()` are idempotent; `close()` fires `onClose` only when the
 * panel actually was open, so a programmatic close and a dismissal notify the
 * owner the same way. `destroy()` tears the listeners and the popover state down
 * without notifying.
 */
export class AnPopover {
  #anchor: HTMLElement;
  #floating: HTMLElement;
  #matchWidth: boolean;
  #offset: number;
  #onClose?: () => void;
  #isOpen = false;
  /** Whether the panel currently sits in the top layer via the popover API. */
  #topLayer = false;
  /** `popover` attribute value found before `open()`, restored by `close()`. */
  #savedPopover: string | null = null;
  #savedStyles: SavedStyles | null = null;

  constructor(options: AnPopoverOptions) {
    this.#anchor = options.anchor;
    this.#floating = options.floating;
    this.#matchWidth = options.matchWidth ?? true;
    this.#offset = options.offset ?? 4;
    this.#onClose = options.onClose;
  }

  /** Whether the panel is currently shown. */
  get isOpen(): boolean {
    return this.#isOpen;
  }

  /** Shows the panel, positions it and starts tracking the viewport. */
  open(): void {
    if (this.#isOpen) return;
    this.#isOpen = true;
    this.#enterTopLayer();
    this.#captureStyles();
    this.reposition();
    this.#listen();
  }

  /** Hides the panel, stops tracking and notifies `onClose`. */
  close(): void {
    if (!this.#isOpen) return;
    this.#isOpen = false;
    this.#unlisten();
    this.#leaveTopLayer();
    this.#restoreStyles();
    this.#onClose?.();
  }

  /** Closes the panel when open, opens it otherwise. */
  toggle(): void {
    if (this.#isOpen) this.close();
    else this.open();
  }

  /** Recomputes the panel position from the current anchor rect. No-op closed. */
  reposition(): void {
    if (!this.#isOpen) return;
    const anchor = this.#anchor.getBoundingClientRect();
    const floating = this.#floating.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const gap = this.#offset;
    const width = this.#matchWidth ? anchor.width : floating.width;
    const height = floating.height;

    // Below the anchor by default; flip above when it does not fit and there is
    // more room on the other side.
    let top = anchor.bottom + gap;
    const below = viewportHeight - anchor.bottom - gap;
    const above = anchor.top - gap;
    if (height > below && above > below) top = anchor.top - gap - height;

    // Keep both edges inside the viewport; a panel wider than the viewport
    // sticks to the left margin instead of going negative.
    const maxLeft = viewportWidth - VIEWPORT_MARGIN - width;
    const left = Math.min(
      Math.max(anchor.left, VIEWPORT_MARGIN),
      Math.max(maxLeft, VIEWPORT_MARGIN),
    );

    const style = this.#floating.style;
    style.top = `${Math.round(top)}px`;
    style.left = `${Math.round(left)}px`;
    if (this.#matchWidth) style.minWidth = `${Math.round(anchor.width)}px`;
  }

  /** Removes every listener, hides the panel and restores its inline styles. */
  destroy(): void {
    this.#isOpen = false;
    this.#unlisten();
    this.#leaveTopLayer();
    this.#restoreStyles();
  }

  /** Promotes the panel to the top layer when the popover API exists. */
  #enterTopLayer(): void {
    const floating = this.#floating;
    if (typeof floating.showPopover !== 'function') return;
    const previous = floating.getAttribute('popover');
    try {
      floating.setAttribute('popover', 'manual');
      floating.showPopover();
      this.#savedPopover = previous;
      this.#topLayer = true;
    } catch {
      // An implementation may expose the method but refuse to show (e.g. the
      // element is not connected): keep the attribute state untouched.
      if (previous === null) floating.removeAttribute('popover');
      else floating.setAttribute('popover', previous);
    }
  }

  /** Leaves the top layer and restores the `popover` attribute. */
  #leaveTopLayer(): void {
    if (this.#topLayer) {
      try {
        this.#floating.hidePopover();
      } catch {
        // Already hidden by the platform (e.g. a forced close).
      }
      const previous = this.#savedPopover;
      if (previous === null) this.#floating.removeAttribute('popover');
      else this.#floating.setAttribute('popover', previous);
    }
    this.#topLayer = false;
    this.#savedPopover = null;
  }

  /** Records the inline styles this class overrides and applies the overrides. */
  #captureStyles(): void {
    const style = this.#floating.style;
    this.#savedStyles = {
      position: style.position,
      top: style.top,
      left: style.left,
      minWidth: style.minWidth,
      inset: style.inset,
      margin: style.margin,
    };
    style.position = 'fixed';
    style.inset = 'auto';
    style.margin = '0';
  }

  /** Restores the inline styles captured by `#captureStyles()`. */
  #restoreStyles(): void {
    const saved = this.#savedStyles;
    this.#savedStyles = null;
    if (!saved) return;
    const style = this.#floating.style;
    style.position = saved.position;
    style.top = saved.top;
    style.left = saved.left;
    style.minWidth = saved.minWidth;
    style.inset = saved.inset;
    style.margin = saved.margin;
  }

  #listen(): void {
    // `capture: true` also sees scrolls that happen in inner scroll containers.
    document.addEventListener('scroll', this.#onScroll, { capture: true, passive: true });
    window.addEventListener('resize', this.#onResize);
    document.addEventListener('pointerdown', this.#onPointerDown, true);
    document.addEventListener('keydown', this.#onKeyDown, true);
  }

  #unlisten(): void {
    document.removeEventListener('scroll', this.#onScroll, true);
    window.removeEventListener('resize', this.#onResize);
    document.removeEventListener('pointerdown', this.#onPointerDown, true);
    document.removeEventListener('keydown', this.#onKeyDown, true);
  }

  #onScroll = (): void => {
    this.reposition();
  };

  #onResize = (): void => {
    this.reposition();
  };

  /**
   * Closes on a pointerdown outside both the anchor and the panel. The composed
   * path is used first so a target inside a shadow tree still counts as inside.
   */
  #onPointerDown = (event: Event): void => {
    if (!this.#isOpen) return;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (path.includes(this.#anchor) || path.includes(this.#floating)) return;
    if (path.length === 0) {
      const target = event.target;
      if (target instanceof Node && (this.#anchor.contains(target) || this.#floating.contains(target))) {
        return;
      }
    }
    this.close();
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    this.close();
  };
}
