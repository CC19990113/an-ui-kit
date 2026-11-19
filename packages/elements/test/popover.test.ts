/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnPopover } from '../src/internal/popover';

/**
 * happy-dom has no popover API and no layout, so the viewport is forced to a
 * known size and both rectangles are mocked. The top-layer tests install
 * `showPopover` / `hidePopover` stubs; the rest take the fixed-position branch.
 */
function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function box(left: number, top: number, width: number, height: number): DOMRect {
  return new DOMRect(left, top, width, height);
}

interface Fixture {
  anchor: HTMLButtonElement;
  floating: HTMLDivElement;
  popover: AnPopover;
  onClose: ReturnType<typeof vi.fn>;
  place: (anchor: DOMRect, floating?: DOMRect) => void;
}

let live: AnPopover[] = [];

function mount(options: { matchWidth?: boolean; offset?: number } = {}): Fixture {
  const anchor = document.createElement('button');
  anchor.textContent = 'anchor';
  const floating = document.createElement('div');
  floating.innerHTML = '<span>panel</span>';
  document.body.append(anchor, floating);

  let anchorRect = box(100, 100, 120, 32);
  let floatingRect = box(0, 0, 120, 120);
  anchor.getBoundingClientRect = () => anchorRect;
  floating.getBoundingClientRect = () => floatingRect;

  const onClose = vi.fn();
  const popover = new AnPopover({ anchor, floating, onClose, ...options });
  live.push(popover);

  return {
    anchor,
    floating,
    popover,
    onClose,
    place: (nextAnchor, nextFloating) => {
      anchorRect = nextAnchor;
      if (nextFloating) floatingRect = nextFloating;
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  setViewport(1000, 800);
  live = [];
});

afterEach(() => {
  for (const popover of live) popover.destroy();
  live = [];
  document.body.innerHTML = '';
});

describe('AnPopover open/close state', () => {
  it('opens below the anchor and falls back to fixed positioning', () => {
    const { floating, popover } = mount();

    expect(popover.isOpen).toBe(false);

    popover.open();
    expect(popover.isOpen).toBe(true);
    expect(floating.style.position).toBe('fixed');
    expect(floating.hasAttribute('popover')).toBe(false);
    expect(floating.style.top).toBe('136px'); // anchor bottom 132 + 4
    expect(floating.style.left).toBe('100px');
  });

  it('matches the anchor width by default and can be turned off', () => {
    const wide = mount();
    wide.popover.open();
    expect(wide.floating.style.minWidth).toBe('120px');

    const narrow = mount({ matchWidth: false });
    narrow.popover.open();
    expect(narrow.floating.style.minWidth).toBe('');
  });

  it('respects the offset option', () => {
    const { floating, popover } = mount({ offset: 10 });

    popover.open();
    expect(floating.style.top).toBe('142px');
  });

  it('toggles and notifies on close', () => {
    const { popover, onClose } = mount();

    popover.toggle();
    expect(popover.isOpen).toBe(true);

    popover.toggle();
    expect(popover.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('only notifies when it actually closes', () => {
    const { popover, onClose } = mount();

    popover.close();
    expect(onClose).not.toHaveBeenCalled();

    popover.open();
    popover.close();
    popover.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores the inline styles it wrote', () => {
    const { floating, popover } = mount();
    floating.style.position = 'absolute';

    popover.open();
    expect(floating.style.position).toBe('fixed');
    expect(floating.style.top).toBe('136px');

    popover.close();
    expect(floating.style.position).toBe('absolute');
    expect(floating.style.top).toBe('');
    expect(floating.style.left).toBe('');
    expect(floating.style.minWidth).toBe('');
  });

  it('does not reposition while closed', () => {
    const { floating, popover } = mount();

    popover.reposition();
    expect(floating.style.top).toBe('');
  });
});

describe('AnPopover positioning', () => {
  it('flips above the anchor when the space below is too small', () => {
    const { floating, popover, place } = mount();
    place(box(100, 728, 120, 32), box(0, 0, 120, 200));

    popover.open();
    expect(floating.style.top).toBe('524px'); // 728 - 4 - 200
  });

  it('shifts left when the panel would overflow the right edge', () => {
    const { floating, popover, place } = mount();
    place(box(960, 100, 120, 32));

    popover.open();
    expect(floating.style.left).toBe('872px'); // 1000 - 8 - 120
  });

  it('shifts right when the anchor sits at the left edge', () => {
    const { floating, popover, place } = mount();
    place(box(0, 100, 120, 32));

    popover.open();
    expect(floating.style.left).toBe('8px');
  });

  it('recomputes on scroll and resize', () => {
    const { floating, popover, place } = mount();
    popover.open();
    expect(floating.style.top).toBe('136px');

    place(box(100, 300, 120, 32));
    document.dispatchEvent(new Event('scroll'));
    expect(floating.style.top).toBe('336px');

    place(box(100, 400, 120, 32));
    window.dispatchEvent(new Event('resize'));
    expect(floating.style.top).toBe('436px');
  });
});

describe('AnPopover top layer', () => {
  it('uses the popover API when the platform supports it', () => {
    const { floating, popover } = mount();
    const show = vi.fn();
    const hide = vi.fn();
    floating.showPopover = show;
    floating.hidePopover = hide;

    popover.open();
    expect(show).toHaveBeenCalledTimes(1);
    expect(floating.getAttribute('popover')).toBe('manual');
    expect(floating.style.position).toBe('fixed');

    popover.close();
    expect(hide).toHaveBeenCalledTimes(1);
    expect(floating.hasAttribute('popover')).toBe(false);
  });

  it('restores a pre-existing popover attribute on close', () => {
    const { floating, popover } = mount();
    floating.setAttribute('popover', 'auto');
    floating.showPopover = vi.fn();
    floating.hidePopover = vi.fn();

    popover.open();
    expect(floating.getAttribute('popover')).toBe('manual');

    popover.close();
    expect(floating.getAttribute('popover')).toBe('auto');
  });

  it('stays out of the top layer when showPopover is missing', () => {
    const { floating, popover } = mount();

    popover.open();
    expect(floating.hasAttribute('popover')).toBe(false);
    expect(floating.style.position).toBe('fixed');
  });
});

describe('AnPopover dismissal', () => {
  it('closes on a pointerdown outside the anchor and the panel', () => {
    const { popover, onClose } = mount();
    popover.open();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(popover.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores pointerdowns inside the anchor or the panel', () => {
    const { anchor, floating, popover } = mount();
    popover.open();

    anchor.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    floating
      .querySelector('span')!
      .dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(popover.isOpen).toBe(true);
  });

  it('closes on Escape and ignores other keys', () => {
    const { popover } = mount();
    popover.open();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(popover.isOpen).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(popover.isOpen).toBe(false);
  });

  it('destroy() removes the listeners and restores the panel', () => {
    const { floating, popover, onClose } = mount();
    floating.showPopover = vi.fn();
    floating.hidePopover = vi.fn();
    popover.open();

    popover.destroy();
    expect(popover.isOpen).toBe(false);
    expect(floating.style.position).toBe('');
    expect(floating.hasAttribute('popover')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
